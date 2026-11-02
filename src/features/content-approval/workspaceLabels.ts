interface WorkspaceLabelSource {
  name: string;
}

export function getWorkspaceDisplayName(workspace: WorkspaceLabelSource): string {
  return workspace.name;
}
