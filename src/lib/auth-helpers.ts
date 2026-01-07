import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';
import { Alert } from 'react-native';

WebBrowser.maybeCompleteAuthSession(); // Handle web completion

export const performGoogleSignIn = async () => {
  try {
    const redirectUrl = makeRedirectUri({
      scheme: 'nz-grills',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No auth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success' && result.url) {
      const url = result.url;
      
      // Extract fragment (implicit grant returns tokens in hash)
      const hashIndex = url.indexOf('#');
      const questionIndex = url.indexOf('?');
      
      let paramsString = '';
      if (hashIndex !== -1) {
          paramsString = url.substring(hashIndex + 1);
      } else if (questionIndex !== -1) {
          paramsString = url.substring(questionIndex + 1);
      }

      // Parse parameters manually to ensure compatibility
      const params: { [key: string]: string } = {};
      paramsString.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      });

      const { access_token, refresh_token } = params;

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (sessionError) throw sessionError;
        return true;
      }
    }
  } catch (error: any) {
    console.log('Google Sign In Error:', error);
    Alert.alert('Google Sign In Error', error.message || 'Authentication failed');
  }
  
  return false;
};
