import { STORES, idbGet, idbGetAll, idbSet, idbDelete } from './db';
import { ProjectMetadata } from '../../types/project';

const SESSION_KEY = 'active_session';

export const projectStore = {
  async getProject(id: string): Promise<ProjectMetadata | undefined> {
    return idbGet<ProjectMetadata>(STORES.PROJECTS, id);
  },

  async getAllProjects(): Promise<ProjectMetadata[]> {
    const list = await idbGetAll<ProjectMetadata>(STORES.PROJECTS);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async saveProject(project: ProjectMetadata): Promise<void> {
    const toSave: ProjectMetadata = {
      ...project,
      updatedAt: new Date().toISOString(),
      version: (project.version || 0) + 1,
      schemaVersion: 1,
    };
    await idbSet(STORES.PROJECTS, toSave);
  },

  async deleteProject(id: string): Promise<void> {
    await idbDelete(STORES.PROJECTS, id);
    const active = await this.getActiveSession();
    if (active === id) {
      await idbDelete(STORES.SESSION, SESSION_KEY);
    }
  },

  async getActiveSession(): Promise<string | undefined> {
    const entry = await idbGet<{ key: string; projectId: string }>(STORES.SESSION, SESSION_KEY);
    return entry?.projectId;
  },

  async setActiveSession(projectId: string): Promise<void> {
    await idbSet(STORES.SESSION, { key: SESSION_KEY, projectId, updatedAt: new Date().toISOString() });
  },

  async clearActiveSession(): Promise<void> {
    await idbDelete(STORES.SESSION, SESSION_KEY);
  },
};
