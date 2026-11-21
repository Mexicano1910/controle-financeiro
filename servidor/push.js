// Ajudantes para enviar notificações push (usados pelos arquivos da pasta api/)
import webpush from 'web-push';

export function prepararPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:avisos@methra.app',
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// Devolve true se enviou. Se o aparelho não existe mais (404/410), apaga a inscrição do banco.
export async function enviarPush(sb, inscricao, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 },
    );
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_inscricoes').delete().eq('id', inscricao.id);
    return false;
  }
}
