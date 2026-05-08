export interface IProjectMemory {
  key: string;
  value: string;
}

export interface IProjectPromptSnippet {
  title: string;
  content: string;
}

export interface IProject {
  projectId: string;
  name?: string;
  description?: string;
  user?: string;
  endpoint?: string;
  model?: string;
  instructions?: string;
  memories?: IProjectMemory[];
  memoryKeys?: string[];
  promptSnippets?: IProjectPromptSnippet[];
  promptGroupIds?: string[];
  fileIds?: string[];
  isArchived?: boolean;
  iconURL?: string;
  accessLevel?: number;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
