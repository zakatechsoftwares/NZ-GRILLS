import React, { useState } from 'react';
import { Modal, StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS } from '../constants/theme';

interface FlutterwaveWebViewProps {
  visible: boolean;
  publicKey: string;
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
  onSuccess: (transactionId: string) => void;
  onError: (error: string) => void;
}

export default function FlutterwaveWebView({
  visible,
  publicKey,
  txRef,
  amount,
  currency,
  customerEmail,
  customerName,
  customerPhone,
  onClose,
  onSuccess,
  onError,
}: FlutterwaveWebViewProps) {
  const [loading, setLoading] = useState(true);

  // Generate Flutterwave payment HTML
  const generatePaymentHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Payment</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f9fafb;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        .loading {
            color: #6B7280;
            font-size: 16px;
            margin-bottom: 20px;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #FF4B3A;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            color: #EF4444;
            padding: 15px;
            background: #FEE2E2;
            border-radius: 8px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <div class="loading">Initializing payment...</div>
        <div id="error" class="error" style="display: none;"></div>
    </div>
    
    <script src="https://checkout.flutterwave.com/v3.js"></script>
    <script>
        function showError(message) {
            document.querySelector('.spinner').style.display = 'none';
            document.querySelector('.loading').style.display = 'none';
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // Send error to React Native
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'error',
                    message: message
                }));
            }
        }
        
        function makePayment() {
            try {
                if (typeof FlutterwaveCheckout === 'undefined') {
                    showError('Flutterwave SDK failed to load. Please check your internet connection.');
                    return;
                }
                
                FlutterwaveCheckout({
                    public_key: "${publicKey}",
                    tx_ref: "${txRef}",
                    amount: ${amount},
                    currency: "${currency}",
                    payment_options: "card,ussd,banktransfer",
                    customer: {
                        email: "${customerEmail}",
                        name: "${customerName}",
                        phone_number: "${customerPhone}"
                    },
                    customizations: {
                        title: "NZ Grills Order Payment",
                        description: "Payment for your order",
                        logo: ""
                    },
                    callback: function(data) {
                        console.log('Payment callback:', data);
                        if (window.ReactNativeWebView) {
                            if (data.status === "successful") {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'success',
                                    transaction_id: data.transaction_id,
                                    tx_ref: data.tx_ref
                                }));
                            } else {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'error',
                                    message: 'Payment was not successful'
                                }));
                            }
                        }
                    },
                    onclose: function() {
                        console.log('Payment modal closed');
                        if (window.ReactNativeWebView) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'closed'
                            }));
                        }
                    }
                });
            } catch (error) {
                console.error('Payment error:', error);
                showError('Failed to initialize payment: ' + error.message);
            }
        }
        
        // Wait for Flutterwave SDK to load, then trigger payment
        window.addEventListener('load', function() {
            setTimeout(function() {
                if (typeof FlutterwaveCheckout !== 'undefined') {
                    makePayment();
                } else {
                    showError('Flutterwave SDK failed to load');
                }
            }, 1000);
        });
    </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'success') {
        onSuccess(data.transaction_id);
      } else if (data.type === 'error') {
        onError(data.message || 'Payment failed');
      } else if (data.type === 'closed') {
        onClose();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      onError('An error occurred during payment');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
        <WebView
          originWhitelist={['*']}
          source={{ html: generatePaymentHTML() }}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
