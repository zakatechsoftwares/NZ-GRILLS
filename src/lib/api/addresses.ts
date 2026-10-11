import { supabase } from '../supabase';

export interface Address {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean | null;
  created_at: string;
  updated_at: string;
}

export type AddressInput = Pick<
  Address,
  'label' | 'address_line1' | 'address_line2' | 'city' | 'postal_code' | 'latitude' | 'longitude' | 'is_default'
>;

export function formatAddress(address: Pick<Address, 'address_line1' | 'address_line2' | 'city'>): string {
  return [address.address_line1, address.address_line2, address.city]
    .filter(part => part && part.trim())
    .join(', ');
}

// Shape stored in orders.delivery_address (couriers and tracking read address/latitude/longitude)
export function toDeliveryAddress(address: Address) {
  return {
    address: formatAddress(address),
    label: address.label,
    address_id: address.id,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

export async function listAddresses(): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Address[];
}

export async function getAddress(id: string): Promise<Address | null> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Address | null;
}

export async function getDefaultAddress(): Promise<Address | null> {
  const addresses = await listAddresses();
  return addresses.find(a => a.is_default) || addresses[0] || null;
}

async function clearOtherDefaults(userId: string, keepId: string) {
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .neq('id', keepId);

  if (error) throw error;
}

export async function saveAddress(userId: string, input: AddressInput, id?: string): Promise<Address> {
  // The first address a user saves becomes their default
  let isDefault = !!input.is_default;
  if (!id && !isDefault) {
    const existing = await listAddresses();
    isDefault = existing.length === 0;
  }

  const row = { ...input, is_default: isDefault, user_id: userId };
  const query = id
    ? supabase.from('addresses').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    : supabase.from('addresses').insert(row);

  const { data, error } = await query.select('*').single();
  if (error) throw error;

  const saved = data as Address;
  if (saved.is_default) await clearOtherDefaults(userId, saved.id);
  return saved;
}

export async function setDefaultAddress(userId: string, id: string) {
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id);

  if (error) throw error;
  await clearOtherDefaults(userId, id);
}

export async function deleteAddress(id: string) {
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) throw error;
}
