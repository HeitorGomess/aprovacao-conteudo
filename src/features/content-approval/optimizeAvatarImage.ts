const MAX_AVATAR_DIMENSION = 512;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 8192;

export async function optimizeAvatarImage(file: File): Promise<File> {
  if (file.size > MAX_AVATAR_SIZE) throw new Error('A imagem deve ter no máximo 5 MB.');
  if (file.type === 'image/gif') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir esta imagem. Tente outro arquivo JPG, PNG ou WebP.');
  }

  try {
    if (bitmap.width > MAX_IMAGE_DIMENSION || bitmap.height > MAX_IMAGE_DIMENSION) {
      throw new Error('A imagem tem dimensões muito grandes. Escolha uma imagem menor.');
    }

    const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem selecionada.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result
          ? resolve(result)
          : reject(new Error('Não foi possível otimizar a imagem selecionada.')),
        'image/webp',
        0.84,
      );
    });

    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, '') || 'avatar'}.webp`,
      { type: 'image/webp', lastModified: Date.now() },
    );
  } finally {
    bitmap.close();
  }
}
