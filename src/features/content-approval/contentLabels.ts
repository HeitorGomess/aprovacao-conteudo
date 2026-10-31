export function getChannelLabel(channel: string): string {
  return channel === 'Multicanal' ? 'Redes sociais' : channel;
}

export function getContentTypeLabel(channel: string, format: string): string {
  return [getChannelLabel(channel), format].filter(Boolean).join(' · ') || 'Conteúdo';
}
