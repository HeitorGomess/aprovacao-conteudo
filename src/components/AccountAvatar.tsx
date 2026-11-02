import { useEffect, useState, type SyntheticEvent } from 'react';

interface AccountAvatarProps {
  email: string;
  avatarUrl?: string;
}

export default function AccountAvatar({ email, avatarUrl = '' }: AccountAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [avatarUrl]);

  function handleImageError(event: SyntheticEvent<HTMLImageElement>): void {
    setImageFailed(true);
    event.currentTarget.removeAttribute('src');
  }

  return (
    <span className="account-avatar" aria-hidden="true">
      {avatarUrl && !imageFailed && (
        <img src={avatarUrl} alt="" loading="lazy" decoding="async" onError={handleImageError} />
      )}
      <span>{email.slice(0, 1).toUpperCase()}</span>
    </span>
  );
}
