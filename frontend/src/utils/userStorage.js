import { supabase } from '../supabaseClient';
import { isOAuthSession } from './authHelpers';

/** Local part of email (e.g. ayush from ayush@gmail.com) */
export function getEmailLocalPart(email) {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[0];
}

export function getStoredUsername() {
  return (
    localStorage.getItem('aegis_user_username') ||
    localStorage.getItem('aegis_user_name') ||
    'Guest'
  );
}

export function getStoredEmail() {
  return localStorage.getItem('aegis_user_email') || '';
}

/** Persist email (and optional username) from Supabase session after OAuth / login */
export async function syncUserFromSession(session) {
  if (!session?.user) return;

  const email = session.user.email || '';
  if (email) localStorage.setItem('aegis_user_email', email);

  const meta = session.user.user_metadata || {};
  const suggested =
    meta.username ||
    meta.preferred_username ||
    meta.full_name ||
    (meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : '') ||
    getEmailLocalPart(email);

  if (isOAuthSession(session)) {
    localStorage.setItem('aegis_auth_method', 'oauth');
    const display = meta.full_name || meta.name || suggested;
    if (display) localStorage.setItem('aegis_user_name', display.trim());
  } else {
    localStorage.setItem('aegis_auth_method', 'email');
    if (suggested && !localStorage.getItem('aegis_user_username')) {
      localStorage.setItem('aegis_user_name', suggested.trim());
    }
  }

  if (email && session.user.id && typeof supabase.from === 'function') {
    const username =
      localStorage.getItem('aegis_user_username') ||
      meta.username ||
      getEmailLocalPart(email);
    // Never block login — profiles upsert can hang under RLS or slow networks
    supabase
      .from('profiles')
      .upsert({ id: session.user.id, username }, { onConflict: 'id' })
      .then(() => null)
      .catch(() => null);
  }

  // Trigger cloud/local synchronization
  syncCloudAndLocalData(session).catch(() => null);
}

export function saveUsername(username) {
  const trimmed = (username || '').trim();
  if (!trimmed) return false;
  localStorage.setItem('aegis_user_username', trimmed);
  localStorage.setItem('aegis_user_name', trimmed);
  return true;
}

export async function syncCloudAndLocalData(session) {
  if (!session?.user) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata || {};

    // 1. Get cloud values
    const cloudScanHistoryRaw = meta.scan_history || '[]';
    const cloudTrainingHistoryRaw = meta.training_history || '[]';
    const cloudXp = parseInt(meta.training_xp || '0');
    const cloudStreak = parseInt(meta.training_streak || '0');
    const cloudIdx = parseInt(meta.training_idx || '0');
    const cloudSetIndex = parseInt(meta.training_set_index || '0');
    const cloudPhone = meta.phone || '';
    const cloudPhoneVerified = meta.phone_verified === true;
    const cloudGmailAddress = meta.gmail_address || '';
    const cloudUsername = meta.username || '';

    // 2. Get local values
    const localScanHistory = JSON.parse(localStorage.getItem('aegis_scan_history') || '[]');
    const localTrainingHistory = JSON.parse(localStorage.getItem('aegis_training_history') || '[]');
    const localXp = parseInt(localStorage.getItem('aegis_training_xp') || '0');
    const localStreak = parseInt(localStorage.getItem('aegis_training_streak') || '0');
    const localIdx = parseInt(localStorage.getItem('aegis_training_idx') || '0');
    const localSetIndex = parseInt(localStorage.getItem('aegis_training_set_index') || '0');
    const localPhone = localStorage.getItem('aegis_user_phone') || '';
    const localPhoneVerified = localStorage.getItem('aegis_phone_verified') === 'true';
    const localGmailAddress = localStorage.getItem('aegis_gmail_address') || '';
    const localUsername = localStorage.getItem('aegis_user_name') || '';

    // 3. Merge Scan History (deduplicated by id)
    let cloudScanHistory = [];
    try {
      cloudScanHistory = typeof cloudScanHistoryRaw === 'string' ? JSON.parse(cloudScanHistoryRaw) : cloudScanHistoryRaw;
    } catch (_) { cloudScanHistory = []; }

    const scanMap = new Map();
    cloudScanHistory.forEach(item => { if (item && item.id) scanMap.set(item.id, item); });
    localScanHistory.forEach(item => { if (item && item.id) scanMap.set(item.id, item); });
    const mergedScanHistory = Array.from(scanMap.values()).sort((a, b) => b.id - a.id).slice(0, 50);

    // 4. Merge Training History
    let cloudTrainingHistory = [];
    try {
      cloudTrainingHistory = typeof cloudTrainingHistoryRaw === 'string' ? JSON.parse(cloudTrainingHistoryRaw) : cloudTrainingHistoryRaw;
    } catch (_) { cloudTrainingHistory = []; }

    const trainingMap = new Map();
    cloudTrainingHistory.forEach((item, idx) => {
      const key = item.timestamp || idx;
      trainingMap.set(key, item);
    });
    localTrainingHistory.forEach((item, idx) => {
      const key = item.timestamp || idx;
      trainingMap.set(key, item);
    });
    const mergedTrainingHistory = Array.from(trainingMap.values());

    // 5. Merge stats
    const mergedXp = Math.max(localXp, cloudXp);
    const mergedStreak = Math.max(localStreak, cloudStreak);
    const mergedIdx = Math.max(localIdx, cloudIdx);
    const mergedSetIndex = Math.max(localSetIndex, cloudSetIndex);

    // 6. Merge profile details
    const mergedPhone = localPhone || cloudPhone;
    const mergedPhoneVerified = localPhoneVerified || cloudPhoneVerified;
    const mergedGmailAddress = localGmailAddress || cloudGmailAddress;
    const mergedUsername = localUsername || cloudUsername;

    // 7. Save back to localStorage
    localStorage.setItem('aegis_scan_history', JSON.stringify(mergedScanHistory));
    localStorage.setItem('aegis_training_history', JSON.stringify(mergedTrainingHistory));
    localStorage.setItem('aegis_training_xp', mergedXp.toString());
    localStorage.setItem('aegis_training_streak', mergedStreak.toString());
    localStorage.setItem('aegis_training_idx', mergedIdx.toString());
    localStorage.setItem('aegis_training_set_index', mergedSetIndex.toString());
    if (mergedPhone) localStorage.setItem('aegis_user_phone', mergedPhone);
    localStorage.setItem('aegis_phone_verified', mergedPhoneVerified.toString());
    if (mergedGmailAddress) localStorage.setItem('aegis_gmail_address', mergedGmailAddress);
    if (mergedUsername) {
      localStorage.setItem('aegis_user_username', mergedUsername);
      localStorage.setItem('aegis_user_name', mergedUsername);
    }

    // 8. Upload back to cloud to ensure 100% sync
    await supabase.auth.updateUser({
      data: {
        scan_history: JSON.stringify(mergedScanHistory),
        training_history: JSON.stringify(mergedTrainingHistory),
        training_xp: mergedXp,
        training_streak: mergedStreak,
        training_idx: mergedIdx,
        training_set_index: mergedSetIndex,
        phone: mergedPhone,
        phone_verified: mergedPhoneVerified,
        gmail_address: mergedGmailAddress,
        username: mergedUsername
      }
    });
  } catch (e) {
    console.error("Failed to sync cloud and local data", e);
  }
}

export async function pushLocalDataToCloud() {
  try {
    const sessionRes = await supabase.auth.getSession();
    const session = sessionRes.data?.session;
    if (!session?.user) return;

    const scanHistory = localStorage.getItem('aegis_scan_history') || '[]';
    const trainingHistory = localStorage.getItem('aegis_training_history') || '[]';
    const xp = parseInt(localStorage.getItem('aegis_training_xp') || '0');
    const streak = parseInt(localStorage.getItem('aegis_training_streak') || '0');
    const idx = parseInt(localStorage.getItem('aegis_training_idx') || '0');
    const setIndex = parseInt(localStorage.getItem('aegis_training_set_index') || '0');
    const phone = localStorage.getItem('aegis_user_phone') || '';
    const phoneVerified = localStorage.getItem('aegis_phone_verified') === 'true';
    const gmailAddress = localStorage.getItem('aegis_gmail_address') || '';
    const username = localStorage.getItem('aegis_user_username') || localStorage.getItem('aegis_user_name') || '';

    await supabase.auth.updateUser({
      data: {
        scan_history: scanHistory,
        training_history: trainingHistory,
        training_xp: xp,
        training_streak: streak,
        training_idx: idx,
        training_set_index: setIndex,
        phone: phone,
        phone_verified: phoneVerified,
        gmail_address: gmailAddress,
        username: username
      }
    });
  } catch (e) {
    console.error("Failed to push sync data to cloud", e);
  }
}

