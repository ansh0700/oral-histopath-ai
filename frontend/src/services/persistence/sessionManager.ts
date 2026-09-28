import { projectStore } from './projectStore';
import { imageStore } from './imageStore';
import { regionStore } from './regionStore';
import { ProjectMetadata, ProjectExportPackage, SaveStatus, ViewerCameraState } from '../../types/project';
import { ImageItem, RegionObject } from '../../types/region';

export class SessionManager {
  private debounceTimer: number | null = null;
  private onStatusChange?: (status: SaveStatus, lastSavedAt?: string, version?: number) => void;
  private lastSavedVersion: number = 0;

  constructor(onStatusChange?: (status: SaveStatus, lastSavedAt?: string, version?: number) => void) {
    this.onStatusChange = onStatusChange;
  }

  public setStatusCallback(cb: (status: SaveStatus, lastSavedAt?: string, version?: number) => void) {
    this.onStatusChange = cb;
  }

  /**
   * Debounced Auto-Save
   */
  public triggerAutosave(
    project: ProjectMetadata,
    image?: ImageItem | null,
    regions: RegionObject[] = [],
    delayMs: number = 500
  ) {
    if (this.onStatusChange) {
      this.onStatusChange('unsaved');
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(async () => {
      await this.saveImmediately(project, image, regions);
    }, delayMs);
  }

  /**
   * Immediate Save Execution
   */
  public async saveImmediately(
    project: ProjectMetadata,
    image?: ImageItem | null,
    regions: RegionObject[] = []
  ): Promise<boolean> {
    if (this.onStatusChange) {
      this.onStatusChange('saving');
    }

    try {
      // 1. Save Project Metadata
      await projectStore.saveProject(project);
      await projectStore.setActiveSession(project.id);

      // 2. Save Image if present
      if (image) {
        await imageStore.saveImage(image);
      }

      // 3. Save Regions with Original Image Coordinates
      if (image) {
        await regionStore.saveRegionsForProject(project.id, image.image_id, regions);
      }

      this.lastSavedVersion = (project.version || 0) + 1;
      const nowIso = new Date().toISOString();

      if (this.onStatusChange) {
        this.onStatusChange('saved', nowIso, this.lastSavedVersion);
      }
      return true;
    } catch (err) {
      console.error('Autosave error:', err);
      if (this.onStatusChange) {
        this.onStatusChange('error');
      }
      return false;
    }
  }

  /**
   * Export Project to JSON download
   */
  public static exportProject(project: ProjectMetadata, image: ImageItem | null, regions: RegionObject[]): void {
    const pkg: ProjectExportPackage = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project,
      image,
      regions,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pkg, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `oral_histopath_${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Import Project Package from JSON file content
   */
  public static async importProject(jsonString: string): Promise<{
    project: ProjectMetadata;
    image?: ImageItem | null;
    regions: RegionObject[];
  }> {
    const parsed = JSON.parse(jsonString) as ProjectExportPackage;

    if (!parsed.project || !parsed.project.id || !parsed.schemaVersion) {
      throw new Error('Invalid project file format: missing required metadata or schema version.');
    }

    const project: ProjectMetadata = {
      ...parsed.project,
      id: `proj_${Date.now()}`,
      name: `${parsed.project.name} (Imported)`,
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const image = parsed.image || null;
    const regions = (parsed.regions || []).map((r) => ({
      ...r,
      id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    }));

    await projectStore.saveProject(project);
    await projectStore.setActiveSession(project.id);

    if (image) {
      await imageStore.saveImage(image);
      await regionStore.saveRegionsForProject(project.id, image.image_id, regions);
    }

    return { project, image, regions };
  }
}
