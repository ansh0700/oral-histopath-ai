import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Layers,
  FileText,
  Microscope,
  FolderOpen,
  Info,
  Activity,
  Maximize2,
  CheckCircle2,
  Scissors,
  Eye,
  Download
} from 'lucide-react';
import { ImageViewer, ImageViewerRef } from './components/ImageViewer';
import { BrushTool } from './components/BrushTool';
import { ExtractedRegion } from './components/ExtractedRegion';
import { RegionList } from './components/RegionList';
import { ResearchLogViewer } from './components/ResearchLogViewer';
import { SaveStatusIndicator } from './components/SaveStatusIndicator';
import { RestoreSessionModal } from './components/RestoreSessionModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { AnnotatedSlideExportModal } from './components/AnnotatedSlideExportModal';

import { api } from './services/api';
import { BrushMode, VectorSelection, LineStyle } from './types/segmentation';
import { RegionObject, ImageItem } from './types/region';
import { ProjectMetadata, SaveStatus } from './types/project';

import { projectStore } from './services/persistence/projectStore';
import { imageStore } from './services/persistence/imageStore';
import { regionStore } from './services/persistence/regionStore';
import { SessionManager } from './services/persistence/sessionManager';
import { rasterizePolygonToBinaryMask, extractRegionClientSide } from './utils/vectorMath';

export function App() {
  // 1. Project & Persistence State
  const [currentProject, setCurrentProject] = useState<ProjectMetadata>({
    id: `proj_${Date.now()}`,
    name: 'Histopathology ROI Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    schemaVersion: 1,
  });
  const [allProjects, setAllProjects] = useState<ProjectMetadata[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toISOString());
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);

  // Restore Dialog on startup
  const [restoreCandidate, setRestoreCandidate] = useState<{
    project: ProjectMetadata;
    image?: ImageItem | null;
    regions: RegionObject[];
  } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);

  // Session Manager reference
  const sessionManagerRef = useRef<SessionManager>(
    new SessionManager((status, time, version) => {
      setSaveStatus(status);
      if (time) setLastSavedAt(time);
      if (version) {
        setCurrentProject((prev) => ({ ...prev, version, updatedAt: time || prev.updatedAt }));
      }
    })
  );

  // 2. Image State
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentImage, setCurrentImage] = useState<ImageItem | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3. Multi-Region State
  const [regions, setRegions] = useState<RegionObject[]>([
    {
      id: 'region_1',
      name: 'Region 1 (Nucleus)',
      category: 'Nucleus',
      color: '#38bdf8',
      vectorSelection: null,
      positiveStrokes: [],
      negativeStrokes: [],
      points: [],
      timestamp: new Date().toISOString(),
    },
  ]);
  const [activeRegionId, setActiveRegionId] = useState<string>('region_1');
  const activeRegion = (regions && regions.length > 0)
    ? (regions.find((r) => r.id === activeRegionId) || regions[0])
    : {
        id: 'region_fallback',
        name: 'Region 1 (Nucleus)',
        category: 'Nucleus' as const,
        color: '#38bdf8',
        vectorSelection: null,
        positiveStrokes: [],
        negativeStrokes: [],
        points: [],
        timestamp: new Date().toISOString(),
      };

  // 4. Camera Focus & Show All Triggers
  const [focusTrigger, setFocusTrigger] = useState<number>(0);
  const [showAllTrigger, setShowAllTrigger] = useState<number>(0);

  // 5. Tool & Selection State
  const [toolMode, setToolMode] = useState<BrushMode>('FREE_SELECT');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [strokeWidth, setStrokeWidth] = useState<number>(1.5);
  const [lineStyle, setLineStyle] = useState<LineStyle>('dotted');
  const [maskOpacity, setMaskOpacity] = useState<number>(0.65);
  const [showOriginal, setShowOriginal] = useState<boolean>(true);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const imageViewerRef = useRef<ImageViewerRef>(null);

  // 6. Comprehensive Undo / Redo History
  const [historyStack, setHistoryStack] = useState<RegionObject[][]>([]);
  const [redoStack, setRedoStack] = useState<RegionObject[][]>([]);

  // 7. Processing State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [showExportSlideModal, setShowExportSlideModal] = useState<boolean>(false);

  // Helper to push history state
  const pushHistorySnapshot = useCallback(() => {
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(regions))]);
    setRedoStack([]);
  }, [regions]);

  // 8. Initialization & Session Restoration
  useEffect(() => {
    const initApp = async () => {
      try {
        const [sampleImages, savedProjects] = await Promise.all([
          api.getSampleDatasets(),
          projectStore.getAllProjects(),
        ]);
        setImages(sampleImages);
        setAllProjects(savedProjects);

        const lastActiveId = await projectStore.getActiveSession();
        const candidateProj = savedProjects.find((p) => p.id === lastActiveId) || savedProjects[savedProjects.length - 1];

        if (candidateProj) {
          const savedImage = candidateProj.currentImageId
            ? (await imageStore.getImage(candidateProj.currentImageId)) ||
              sampleImages.find((s) => s.image_id === candidateProj.currentImageId)
            : sampleImages[0];

          const savedRegions = savedImage
            ? await regionStore.getRegionsForProject(candidateProj.id, savedImage.image_id)
            : [];

          setRestoreCandidate({
            project: candidateProj,
            image: savedImage || (sampleImages.length > 0 ? sampleImages[0] : null),
            regions: savedRegions,
          });
          setShowRestoreModal(true);
          return;
        }

        if (sampleImages.length > 0) {
          setCurrentImage(sampleImages[0]);
          const defaultProj: ProjectMetadata = {
            id: 'proj_default_session',
            name: 'Histopathology ROI Session 1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            schemaVersion: 1,
            currentImageId: sampleImages[0].image_id,
          };
          setCurrentProject(defaultProj);
          await projectStore.saveProject(defaultProj);
          await projectStore.setActiveSession(defaultProj.id);
          setAllProjects([defaultProj]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initApp();
  }, []);

  // 9. Session Restoration Actions
  const handleContinueSession = useCallback(() => {
    if (!restoreCandidate) return;
    const { project, image, regions: savedRegions } = restoreCandidate;

    setCurrentProject(project);
    if (image) setCurrentImage(image);
    setRegions(savedRegions);
    if (project.activeRegionId) setActiveRegionId(project.activeRegionId);
    if (project.toolMode) setToolMode(project.toolMode);

    setShowRestoreModal(false);
    setRestoreCandidate(null);

    setTimeout(() => {
      setFocusTrigger((t) => t + 1);
    }, 150);
  }, [restoreCandidate]);

  const handleStartNewProject = useCallback(async (name?: string) => {
    const newProj: ProjectMetadata = {
      id: `proj_${Date.now()}`,
      name: name || `Histopathology Session ${allProjects.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      schemaVersion: 1,
      currentImageId: currentImage?.image_id,
    };

    const initialRegion: RegionObject = {
      id: `reg_${Date.now()}`,
      name: 'Region 1 (Nucleus)',
      category: 'Nucleus',
      color: '#38bdf8',
      vectorSelection: null,
      positiveStrokes: [],
      negativeStrokes: [],
      points: [],
      timestamp: new Date().toISOString(),
    };

    setCurrentProject(newProj);
    setRegions([initialRegion]);
    setActiveRegionId(initialRegion.id);
    setShowRestoreModal(false);
    setRestoreCandidate(null);
    setHistoryStack([]);
    setRedoStack([]);

    await projectStore.saveProject(newProj);
    await projectStore.setActiveSession(newProj.id);
    const updated = await projectStore.getAllProjects();
    setAllProjects(updated);
  }, [allProjects.length, currentImage?.image_id]);

  // 10. Centralized Auto-Save Effect (Debounced 500ms)
  useEffect(() => {
    if (showRestoreModal || !currentProject) return;

    const projToSave: ProjectMetadata = {
      ...currentProject,
      currentImageId: currentImage?.image_id || null,
      activeRegionId: activeRegionId || null,
      toolMode,
      brushSize,
      maskOpacity,
    };

    sessionManagerRef.current.triggerAutosave(projToSave, currentImage, regions, 500);
  }, [
    currentProject.id,
    currentProject.name,
    currentImage?.image_id,
    regions,
    activeRegionId,
    toolMode,
    brushSize,
    maskOpacity,
    showRestoreModal,
  ]);

  // Immediate save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentProject && currentImage) {
        sessionManagerRef.current.saveImmediately(currentProject, currentImage, regions);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentProject, currentImage, regions]);

  // 11. Vector Selection Change Handler
  const handleVectorSelectionChange = useCallback((newVectorSel: VectorSelection | null, rasterMaskB64?: string) => {
    pushHistorySnapshot();
    setIsConfirmed(false);

    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== activeRegionId) return r;
        return {
          ...r,
          vectorSelection: newVectorSel,
          finalEditedMaskB64: rasterMaskB64 || r.finalEditedMaskB64,
          aiMaskB64: rasterMaskB64 || r.aiMaskB64,
          bbox: newVectorSel?.bbox || null,
        };
      })
    );
  }, [activeRegionId, pushHistorySnapshot]);

  // 11b. Auto-Add New Region With Selection (Preserves existing selections when drawing multiple regions)
  const handleAddNewRegionWithSelection = useCallback(
    (newVectorSel: VectorSelection, rasterMaskB64?: string) => {
      pushHistorySnapshot();
      setIsConfirmed(false);

      const colors = ['#38bdf8', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#10b981', '#6366f1'];
      const newIdx = regions.length + 1;
      const category = activeRegion?.category || 'Nucleus';
      const newRegion: RegionObject = {
        id: `region_${Date.now()}`,
        name: `Region ${newIdx}`,
        category: category,
        color: colors[(newIdx - 1) % colors.length],
        vectorSelection: newVectorSel,
        positiveStrokes: [],
        negativeStrokes: [],
        points: [],
        finalEditedMaskB64: rasterMaskB64 || null,
        aiMaskB64: rasterMaskB64 || null,
        bbox: newVectorSel.bbox || null,
        timestamp: new Date().toISOString(),
      };

      setRegions((prev) => [...prev, newRegion]);
      setActiveRegionId(newRegion.id);
      setSelectedVertexIndex(null);
    },
    [regions.length, activeRegion?.category, pushHistorySnapshot]
  );

  // 12. Mask Update Handler (from ADD / ERASE brush)
  const handleMaskUpdate = useCallback((newMaskB64: string, newBbox: [number, number, number, number], areaPixels: number) => {
    pushHistorySnapshot();
    setIsConfirmed(false);

    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== activeRegionId) return r;
        return {
          ...r,
          finalEditedMaskB64: newMaskB64,
          aiMaskB64: newMaskB64,
          bbox: newBbox,
        };
      })
    );
  }, [activeRegionId, pushHistorySnapshot]);

  // 13. Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    if (historyStack.length === 0) return;

    const previousState = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(regions))]);
    setHistoryStack((prev) => prev.slice(0, -1));
    setRegions(previousState);
    setSelectedVertexIndex(null);
    setIsConfirmed(false);
  }, [historyStack, regions]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(regions))]);
    setRedoStack((prev) => prev.slice(0, -1));
    setRegions(nextState);
    setSelectedVertexIndex(null);
    setIsConfirmed(false);
  }, [redoStack, regions]);

  const handleClear = useCallback(() => {
    pushHistorySnapshot();
    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== activeRegionId) return r;
        return {
          ...r,
          vectorSelection: null,
          positiveStrokes: [],
          negativeStrokes: [],
          aiMaskB64: null,
          finalEditedMaskB64: null,
          contour: null,
          bbox: null,
          cropUrl: null,
          cutoutUrl: null,
          cropBase64: null,
          cutoutBase64: null,
          analysis: null,
        };
      })
    );
    setSelectedVertexIndex(null);
    setIsConfirmed(false);
  }, [activeRegionId, pushHistorySnapshot]);

  // 14. Image Upload Handler (with client-side local ObjectURL fallback)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let uploaded: ImageItem;
      try {
        uploaded = await api.uploadImage(file);
      } catch (backendErr: any) {
        console.warn('Backend upload server error, falling back to local client-side slide viewer:', backendErr);
        const objectUrl = URL.createObjectURL(file);
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 1200, height: 800 });
          img.src = objectUrl;
        });

        const imageId = `img_${Date.now()}`;
        uploaded = {
          image_id: imageId,
          filename: file.name,
          width: dimensions.width,
          height: dimensions.height,
          channels: 3,
          url: objectUrl,
          thumbnail_url: objectUrl,
          is_sample: false,
          metadata: {
            width: dimensions.width,
            height: dimensions.height,
            format: file.type.split('/')[1]?.toUpperCase() || 'PNG',
            file_size_bytes: file.size,
          },
        };
      }

      setImages((prev) => [uploaded, ...prev]);
      setCurrentImage(uploaded);
      await imageStore.saveImage(uploaded, file);
      handleClear();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 15. Confirm Selection
  const handleConfirmSelection = useCallback(() => {
    if (!activeRegion.vectorSelection && !activeRegion.finalEditedMaskB64) {
      alert('Please create a region selection first.');
      return;
    }
    setIsConfirmed(true);
    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== activeRegionId) return r;
        return {
          ...r,
          isConfirmed: true,
          vectorSelection: r.vectorSelection
            ? { ...r.vectorSelection, isConfirmed: true }
            : null,
        };
      })
    );
  }, [activeRegion.vectorSelection, activeRegion.finalEditedMaskB64, activeRegionId]);

  // 16. Extract Region & Quantitative Analysis (with Client-Side Local Canvas Fallback)
  const handleRunExtraction = useCallback(async () => {
    let mask = activeRegion.finalEditedMaskB64;
    if (!mask && activeRegion.vectorSelection && currentImage) {
      mask = rasterizePolygonToBinaryMask(
        activeRegion.vectorSelection.points,
        currentImage.width,
        currentImage.height
      );
    }

    if (!currentImage || (!mask && (!activeRegion.vectorSelection || activeRegion.vectorSelection.points.length < 3))) {
      alert('Please draw a region selection around a nucleus or cell first.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Extracting selected region crop...');

    try {
      // 1. Client-Side Instant Canvas Crop & Cutout Generation
      let clientCrop = {
        cropUrl: '',
        cutoutUrl: '',
        cropBase64: '',
        cutoutBase64: '',
        bbox: activeRegion.bbox || ([0, 0, currentImage.width, currentImage.height] as [number, number, number, number]),
        areaPixels: 0,
      };

      const points = activeRegion.vectorSelection?.points || [];
      if (points.length > 0 && currentImage.url) {
        try {
          const tempImg = new window.Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.src = currentImage.url;
          await new Promise((resolve) => {
            if (tempImg.complete) resolve(true);
            else {
              tempImg.onload = () => resolve(true);
              tempImg.onerror = () => resolve(false);
            }
          });
          clientCrop = extractRegionClientSide(tempImg, points);
        } catch (canvasErr) {
          console.warn('Client canvas crop error:', canvasErr);
        }
      }

      let cropUrl = clientCrop.cropUrl;
      let cutoutUrl = clientCrop.cutoutUrl;
      let cropBase64 = clientCrop.cropBase64;
      let cutoutBase64 = clientCrop.cutoutBase64;
      let bbox = clientCrop.bbox;
      let analysisRes = null;

      // 2. Try Backend API Extraction & Analysis (Fallback gracefully if backend unavailable/missing file)
      if (mask) {
        try {
          const [extractRes, anaRes] = await Promise.all([
            api.extractRegion({ imageId: currentImage.image_id, mask }),
            api.analyze({ imageId: currentImage.image_id, mask }),
          ]);
          if (extractRes?.crop_url) {
            cropUrl = extractRes.crop_url;
            cutoutUrl = extractRes.cutout_url;
            cropBase64 = extractRes.crop_base64 || extractRes.crop_url;
            cutoutBase64 = extractRes.cutout_base64 || extractRes.cutout_url;
            bbox = extractRes.bbox;
          }
          analysisRes = anaRes;
        } catch (backendErr) {
          console.warn('Backend extraction server call skipped/failed, using client-side canvas crop:', backendErr);
        }
      }

      setRegions((prev) =>
        prev.map((r) => {
          if (r.id !== activeRegionId) return r;
          return {
            ...r,
            cropUrl: cropUrl || r.cropUrl,
            cutoutUrl: cutoutUrl || r.cutoutUrl,
            cropBase64: cropBase64 || r.cropBase64,
            cutoutBase64: cutoutBase64 || r.cutoutBase64,
            bbox: bbox || r.bbox,
            analysis: analysisRes || r.analysis,
          };
        })
      );
      setIsConfirmed(true);
    } catch (err: any) {
      console.error('Extraction error:', err);
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  }, [activeRegion.finalEditedMaskB64, activeRegion.vectorSelection, activeRegion.bbox, currentImage, activeRegionId]);

  // 16b. Batch Extract & Analyze All Regions
  const handleExtractAllRegions = useCallback(async () => {
    if (!currentImage) return;
    const regionsWithSelections = regions.filter((r) => r.vectorSelection || r.finalEditedMaskB64);
    if (regionsWithSelections.length === 0) {
      alert('Please create region selections first.');
      return;
    }

    setIsProcessing(true);
    setStatusMessage(`Extracting & analyzing ${regionsWithSelections.length} regions...`);

    try {
      const updatedRegions = await Promise.all(
        regions.map(async (r) => {
          let mask = r.finalEditedMaskB64;
          if (!mask && r.vectorSelection && currentImage) {
            mask = rasterizePolygonToBinaryMask(
              r.vectorSelection.points,
              currentImage.width,
              currentImage.height
            );
          }
          if (!mask) return r;

          try {
            const [extractRes, analysisRes] = await Promise.all([
              api.extractRegion({ imageId: currentImage.image_id, mask }),
              api.analyze({ imageId: currentImage.image_id, mask }),
            ]);
            return {
              ...r,
              cropUrl: extractRes.crop_url,
              cutoutUrl: extractRes.cutout_url,
              cropBase64: extractRes.crop_base64,
              cutoutBase64: extractRes.cutout_base64,
              bbox: extractRes.bbox,
              analysis: analysisRes,
            };
          } catch {
            return r;
          }
        })
      );

      setRegions(updatedRegions);
      setIsConfirmed(true);
    } catch (err: any) {
      alert(`Batch extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage(null);
    }
  }, [currentImage, regions]);

  // 17. Multi-Region Management
  const handleSelectRegion = useCallback((id: string) => {
    setActiveRegionId(id);
    setSelectedVertexIndex(null);
    const target = regions.find((r) => r.id === id);
    if (target) {
      setIsConfirmed(!!target.isConfirmed);
    }
  }, [regions]);

  const handleFocusRegion = useCallback((id: string) => {
    setActiveRegionId(id);
    setFocusTrigger((t) => t + 1);
  }, []);

  const handleShowAllRegions = useCallback(() => {
    setShowAllTrigger((t) => t + 1);
  }, []);

  const handlePrevRegion = useCallback(() => {
    const idx = regions.findIndex((r) => r.id === activeRegionId);
    if (idx > 0) {
      handleSelectRegion(regions[idx - 1].id);
    } else if (regions.length > 0) {
      handleSelectRegion(regions[regions.length - 1].id);
    }
  }, [regions, activeRegionId, handleSelectRegion]);

  const handleNextRegion = useCallback(() => {
    const idx = regions.findIndex((r) => r.id === activeRegionId);
    if (idx < regions.length - 1) {
      handleSelectRegion(regions[idx + 1].id);
    } else if (regions.length > 0) {
      handleSelectRegion(regions[0].id);
    }
  }, [regions, activeRegionId, handleSelectRegion]);

  const handleAddRegion = useCallback((category: RegionObject['category']) => {
    pushHistorySnapshot();
    const newIdx = regions.length + 1;
    const colors = ['#38bdf8', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4'];
    const newRegion: RegionObject = {
      id: `region_${Date.now()}`,
      name: `Region ${newIdx} (${category})`,
      category: category,
      color: colors[newIdx % colors.length],
      vectorSelection: null,
      positiveStrokes: [],
      negativeStrokes: [],
      points: [],
      timestamp: new Date().toISOString(),
    };
    setRegions((prev) => [...prev, newRegion]);
    setActiveRegionId(newRegion.id);
    setSelectedVertexIndex(null);
    setIsConfirmed(false);
  }, [regions.length, pushHistorySnapshot]);

  const handleUpdateRegionName = useCallback((id: string, newName: string) => {
    pushHistorySnapshot();
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: newName } : r))
    );
  }, [pushHistorySnapshot]);

  const handleUpdateRegionComment = useCallback((id: string, comment: string) => {
    pushHistorySnapshot();
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, comment: comment } : r))
    );
  }, [pushHistorySnapshot]);

  const handleDeleteRegion = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (regions.length <= 1) return;
    pushHistorySnapshot();
    const remaining = regions.filter((r) => r.id !== id);
    setRegions(remaining);
    regionStore.deleteRegion(id).catch(console.error);
    if (activeRegionId === id) {
      setActiveRegionId(remaining[0].id);
    }
    setSelectedVertexIndex(null);
  }, [regions, activeRegionId, pushHistorySnapshot]);

  // 18. Project Persistence Handlers
  const handleSwitchProject = useCallback(async (projId: string) => {
    const target = await projectStore.getProject(projId);
    if (!target) return;

    const savedImage = target.currentImageId
      ? (await imageStore.getImage(target.currentImageId)) ||
        images.find((s) => s.image_id === target.currentImageId)
      : images[0];

    const savedRegions = savedImage
      ? await regionStore.getRegionsForProject(target.id, savedImage.image_id)
      : [];

    setCurrentProject(target);
    if (savedImage) setCurrentImage(savedImage);
    setRegions(
      savedRegions.length > 0
        ? savedRegions
        : [
            {
              id: `reg_${Date.now()}`,
              name: 'Region 1 (Nucleus)',
              category: 'Nucleus',
              color: '#38bdf8',
              vectorSelection: null,
              positiveStrokes: [],
              negativeStrokes: [],
              points: [],
              timestamp: new Date().toISOString(),
            },
          ]
    );

    if (target.activeRegionId) setActiveRegionId(target.activeRegionId);
    await projectStore.setActiveSession(target.id);
    setShowProjectModal(false);
    setHistoryStack([]);
    setRedoStack([]);

    setTimeout(() => {
      setFocusTrigger((t) => t + 1);
    }, 150);
  }, [images]);

  const handleRenameProject = useCallback(async (projId: string, newName: string) => {
    const proj = await projectStore.getProject(projId);
    if (proj) {
      const updated = { ...proj, name: newName };
      await projectStore.saveProject(updated);
      if (currentProject.id === projId) {
        setCurrentProject(updated);
      }
      const all = await projectStore.getAllProjects();
      setAllProjects(all);
    }
  }, [currentProject.id]);

  const handleDeleteProject = useCallback(async (projId: string) => {
    await projectStore.deleteProject(projId);
    await regionStore.deleteRegionsForProject(projId);

    const all = await projectStore.getAllProjects();
    setAllProjects(all);

    if (currentProject.id === projId) {
      if (all.length > 0) {
        await handleSwitchProject(all[0].id);
      } else {
        await handleStartNewProject();
      }
    }
  }, [currentProject.id, handleSwitchProject, handleStartNewProject]);

  const handleExportCurrentProject = useCallback(() => {
    SessionManager.exportProject(currentProject, currentImage, regions);
  }, [currentProject, currentImage, regions]);

  const handleImportProject = useCallback(async (jsonString: string) => {
    const { project, image, regions: importedRegions } = await SessionManager.importProject(jsonString);
    setCurrentProject(project);
    if (image) {
      setImages((prev) => [image, ...prev.filter((i) => i.image_id !== image.image_id)]);
      setCurrentImage(image);
    }
    setRegions(importedRegions);
    if (importedRegions.length > 0) {
      setActiveRegionId(importedRegions[0].id);
    }
    const all = await projectStore.getAllProjects();
    setAllProjects(all);
    setHistoryStack([]);
    setRedoStack([]);

    setTimeout(() => {
      setFocusTrigger((t) => t + 1);
    }, 150);
  }, []);

  const hasSelection = !!(activeRegion?.vectorSelection || activeRegion?.finalEditedMaskB64);
  const vertexCount = activeRegion?.vectorSelection?.points.length || 0;
  const currentBBox = activeRegion?.vectorSelection?.bbox || activeRegion?.bbox;
  const currentArea = activeRegion?.analysis?.measurements.area_pixels || activeRegion?.vectorSelection?.areaPixels || 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Navigation Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-medical-600 rounded-lg shadow-lg shadow-cyan-950">
            <Microscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 tracking-wide flex items-center space-x-2">
              <span>Oral Histopathology Analyzer</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                Precision Morphometry
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              ROI Selection & Quantitative Morphometric Extraction
            </p>
          </div>
        </div>

        {/* Project Status, Slide Picker & Actions */}
        <div className="flex items-center space-x-3">
          <SaveStatusIndicator
            status={saveStatus}
            lastSavedAt={lastSavedAt}
            version={currentProject.version}
            projectName={currentProject.name}
            onOpenProjectManager={() => setShowProjectModal(true)}
          />

          {/* Slide Picker Dropdown */}
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <FolderOpen className="w-4 h-4 text-medical-400" />
            <select
              value={currentImage?.image_id || ''}
              onChange={(e) => {
                const img = images.find((i) => i.image_id === e.target.value);
                if (img) {
                  setCurrentImage(img);
                  handleClear();
                }
              }}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer max-w-sm truncate"
            >
              {images.map((img) => (
                <option key={img.image_id} value={img.image_id} className="bg-slate-900 text-slate-200">
                  {img.is_sample ? `[PDF Ref] ${img.metadata?.clinical_context || img.filename}` : img.filename}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-medical-400" />
            <span>Upload Slide</span>
          </button>

          {/* Download Full Annotated Slide Trigger */}
          <button
            onClick={() => setShowExportSlideModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-bold rounded-lg shadow-md shadow-amber-500/20 transition-transform active:scale-95"
            title="Download full slide image with all marked shape boundaries"
          >
            <Download className="w-3.5 h-3.5 font-bold" />
            <span>Download Annotated Slide</span>
          </button>

          {/* Research Logs Modal Trigger */}
          <button
            onClick={() => setShowLogsModal(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="View Audit Logs"
          >
            <FileText className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </header>

      {/* 3. Main Dashboard Workspace (2-Column Layout) */}
      <div className="flex-1 flex overflow-hidden">
        {/* CENTER / LEFT COLUMN: Interactive Histopathology Canvas Viewer */}
        <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
          {/* Main Layered Canvas Viewer */}
          <div className="flex-1 relative overflow-hidden">
            {currentImage ? (
              <ImageViewer
                ref={imageViewerRef}
                imageUrl={currentImage.url}
                imageWidth={currentImage.width}
                imageHeight={currentImage.height}
                mode={toolMode}
                setMode={setToolMode}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
                lineStyle={lineStyle}
                maskOpacity={maskOpacity}
                showOriginal={showOriginal}
                isConfirmed={isConfirmed}
                onMaskUpdate={handleMaskUpdate}
                vectorSelection={activeRegion.vectorSelection}
                onVectorSelectionChange={handleVectorSelectionChange}
                onAddNewRegionWithSelection={handleAddNewRegionWithSelection}
                onConfirmSelection={handleConfirmSelection}
                onExtractRegion={handleRunExtraction}
                onExportAnnotatedSlide={() => setShowExportSlideModal(true)}
                regions={regions}
                activeRegionId={activeRegionId}
                onSelectRegion={handleSelectRegion}
                focusTrigger={focusTrigger}
                showAllTrigger={showAllTrigger}
                selectedVertexIndex={selectedVertexIndex}
                setSelectedVertexIndex={setSelectedVertexIndex}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                Loading oral histopathology slide...
              </div>
            )}

            {/* Processing Spinner Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-30">
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl flex items-center space-x-3 text-sm font-semibold text-slate-200">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>{statusMessage || 'Processing...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Docked Manual Tool & Interaction Toolbar */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 shrink-0 z-20">
            <BrushTool
              mode={toolMode}
              setMode={setToolMode}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              lineStyle={lineStyle}
              setLineStyle={setLineStyle}
              maskOpacity={maskOpacity}
              setMaskOpacity={setMaskOpacity}
              showOriginal={showOriginal}
              setShowOriginal={setShowOriginal}
              canUndo={historyStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              onConfirmSelection={handleConfirmSelection}
              onExtract={handleRunExtraction}
              isProcessing={isProcessing}
              hasSelection={hasSelection}
              isConfirmed={isConfirmed}
              selectedVertexIndex={selectedVertexIndex}
              onAddVertex={() => {
                imageViewerRef.current?.addPointAtSelection();
              }}
              onDeleteSelectedVertex={() => {
                imageViewerRef.current?.deleteSelectedPoint();
              }}
              onSmoothContour={() => {
                imageViewerRef.current?.smoothCurrentContour();
              }}
              onTrimSpikes={() => {
                imageViewerRef.current?.trimSpikes();
              }}
              vertexCount={vertexCount}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Multi-Region, ROI Info, Extracted Output & Morphological Analysis */}
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-y-auto p-3 space-y-3 shrink-0">
          {/* Multi-Region Manager */}
          <RegionList
            regions={regions}
            activeRegionId={activeRegionId}
            onSelectRegion={handleSelectRegion}
            onAddRegion={handleAddRegion}
            onDeleteRegion={handleDeleteRegion}
            onFocusRegion={handleFocusRegion}
            onShowAllRegions={handleShowAllRegions}
            onPrevRegion={handlePrevRegion}
            onNextRegion={handleNextRegion}
            onExtractAll={handleExtractAllRegions}
            onExportAnnotatedSlide={() => setShowExportSlideModal(true)}
            onUpdateRegionName={handleUpdateRegionName}
            onUpdateRegionComment={handleUpdateRegionComment}
          />


          {/* Extracted Region Crop & Cutout */}
          <ExtractedRegion
            cropUrl={activeRegion.cropUrl}
            cutoutUrl={activeRegion.cutoutUrl}
            cropBase64={activeRegion.cropBase64}
            cutoutBase64={activeRegion.cutoutBase64}
            bbox={activeRegion.bbox}
            areaPixels={currentArea}
          />
        </div>
      </div>

      {/* 4. Restore Session Modal */}
      {restoreCandidate && (
        <RestoreSessionModal
          isOpen={showRestoreModal}
          project={restoreCandidate.project}
          regionCount={restoreCandidate.regions.length}
          onContinueSession={handleContinueSession}
          onStartNewProject={() => handleStartNewProject()}
        />
      )}

      {/* 5. Project Management Dialog */}
      <ProjectManagerModal
        isOpen={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        projects={allProjects}
        activeProjectId={currentProject.id}
        onSwitchProject={handleSwitchProject}
        onCreateNewProject={handleStartNewProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onExportCurrentProject={handleExportCurrentProject}
        onImportProject={handleImportProject}
      />

      {/* 6. Research Audit Logs Modal */}
      <ResearchLogViewer
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />

      {/* 7. Full Annotated Slide Export Modal */}
      {currentImage && (
        <AnnotatedSlideExportModal
          isOpen={showExportSlideModal}
          onClose={() => setShowExportSlideModal(false)}
          imageUrl={currentImage.url}
          imageWidth={currentImage.width}
          imageHeight={currentImage.height}
          slideName={currentImage.is_sample ? (currentImage.metadata?.clinical_context || currentImage.filename) : currentImage.filename}
          clinicalContext={currentImage.metadata?.clinical_context}
          regions={regions}
          activeVectorSelection={activeRegion.vectorSelection || null}
          activeRegionId={activeRegionId}
        />
      )}
    </div>
  );
}

export default App;
