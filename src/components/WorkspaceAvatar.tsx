interface WorkspaceAvatarProps {
  url?: string;
  fallback: string;
  size?: 'small' | 'large';
}

export default function WorkspaceAvatar({ url = '', fallback, size = 'small' }: WorkspaceAvatarProps) {
  return (
    <span className={`workspace-avatar workspace-avatar-${size}`} aria-hidden="true">
      <span>{fallback}</span>
      {url && (
        <img
          alt=""
          src={url}
          onError={(event) => event.currentTarget.remove()}
        />
      )}
    </span>
  );
}
