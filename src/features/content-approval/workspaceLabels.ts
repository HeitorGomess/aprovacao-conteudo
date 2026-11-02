interface WorkspaceLabelSource {
  name: string;
  slug: string;
}

export function getWorkspaceDisplayName(workspace: WorkspaceLabelSource): string {
  return workspace.slug === 'your-space' ? 'Space Social' : workspace.name;
}
