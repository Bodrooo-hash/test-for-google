import { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload, FileText, FileImage, FileSpreadsheet, File, Download,
  Trash2, Loader2, FolderUp, FolderPlus, Folder, MoreVertical,
  Pencil, Move, ChevronRight, Home, Shield } from
"lucide-react";
import imageCompression from "browser-image-compression";
import { externalSupabase } from "@/lib/externalSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from
"@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from
"@/components/ui/dialog";
import FolderPermissionsModal from "@/components/FolderPermissionsModal";
import {
  fetchCurrentUserProfile,
  fetchFolderPermissions,
  canAccessFolder,
  type FolderPermission,
  type UserProfile,
} from "@/lib/folder-permissions";

const BUCKET = "documents";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return <File size={18} className="text-muted-foreground" />;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
  return <FileImage size={18} className="text-blue-400" />;
  if (["xls", "xlsx", "csv"].includes(ext))
  return <FileSpreadsheet size={18} className="text-green-500" />;
  if (["doc", "docx", "pdf", "txt", "rtf"].includes(ext))
  return <FileText size={18} className="text-orange-400" />;
  return <File size={18} className="text-muted-foreground" />;
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ENC_PREFIX = "enc_";

const encodeName = (str: string): string => {
  const bytes = new TextEncoder().encode(str.trim());
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return ENC_PREFIX + hex;
};

const encodeFileName = (name: string): string => {
  const ext = name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  const base = name.slice(0, name.length - ext.length).trim();
  return `${Date.now()}_${encodeName(base || "file")}${ext}`;
};

export const encodeFolderName = (name: string): string => encodeName(name.trim() || "folder");

const decodeName = (encoded: string): string => {
  // strip timestamp prefix like "1234567890_"
  const withoutTs = encoded.replace(/^\d+_/, "");
  if (!withoutTs.startsWith(ENC_PREFIX)) return encoded.replace(/^\d+_/, "") || encoded;
  const hex = withoutTs.slice(ENC_PREFIX.length);
  try {
    const bytes = new Uint8Array((hex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(bytes);
  } catch {
    return encoded;
  }
};

const decodeSegment = (name: string): string => {
  if (!name.startsWith(ENC_PREFIX)) return name;
  try {
    const hex = name.slice(ENC_PREFIX.length);
    const bytes = new Uint8Array((hex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(bytes);
  } catch {
    return name;
  }
};

interface StorageItem {
  name: string;
  id?: string | null;
  created_at?: string;
  metadata?: {size?: number;mimetype?: string;} | null;
}

interface CompanyDiskProps {
  initialPath?: string[];
}

const CompanyDisk = ({ initialPath }: CompanyDiskProps = {}) => {
  const [currentPath, setCurrentPath] = useState<string[]>(initialPath ?? []);
  const [folders, setFolders] = useState<StorageItem[]>([]);
  const [files, setFiles] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [targetItem, setTargetItem] = useState<{name: string;isFolder: boolean;} | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveTarget, setMoveTarget] = useState("");
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [permissionsFolderPath, setPermissionsFolderPath] = useState("");
  const [permissionsFolderName, setPermissionsFolderName] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [folderPermissions, setFolderPermissions] = useState<FolderPermission[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const { toast } = useToast();

  const isAdmin = userProfile?.role === "Администратор";
  const pathPrefix = currentPath.length > 0 ? currentPath.join("/") + "/" : "";

  // Fetch current user profile and folder permissions on mount
  useEffect(() => {
    fetchCurrentUserProfile().then(setUserProfile);
    fetchFolderPermissions().then(setFolderPermissions);
  }, []);

  // Refresh permissions when modal closes
  const handlePermissionsChange = (open: boolean) => {
    setPermissionsOpen(open);
    if (!open) {
      fetchFolderPermissions().then(setFolderPermissions);
    }
  };

  const fetchFiles = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadProgress(0);

    // Animate to ~65% quickly, then slow down
    const t1 = setTimeout(() => setLoadProgress(45), 80);
    const t2 = setTimeout(() => setLoadProgress(65), 400);

    const { data, error } = await externalSupabase.storage.from(BUCKET).list(
      currentPath.join("/") || "",
      { limit: 500, sortBy: { column: "name", order: "asc" } }
    );

    clearTimeout(t1);
    clearTimeout(t2);

    if (requestId !== requestIdRef.current) return;

    // Complete the bar
    setLoadProgress(100);

    if (error) {
      toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
      setFolders([]);
      setFiles([]);
    } else {
      const items = (data ?? []).filter(
        (f) => f.name !== ".emptyFolderPlaceholder" && f.name !== ".keep"
      );
      setFolders(items.filter((f) => f.id === null));
      setFiles(items.filter((f) => f.id !== null));
    }

    // Small delay so user sees bar reach 100%
    setTimeout(() => {
      if (requestIdRef.current === requestId) {
        setLoading(false);
        setLoadProgress(0);
      }
    }, 300);
  }, [currentPath, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const navigateToFolder = (folderName: string) => {
    setLoading(true);
    setLoadProgress(0);
    setCurrentPath((prev) => [...prev, folderName]);
  };

  const navigateToBreadcrumb = (index: number) => {
    setLoading(true);
    setLoadProgress(0);
    setCurrentPath((prev) => prev.slice(0, index));
  };

  const maybeCompress = async (file: File): Promise<File> => {
    if (!IMAGE_TYPES.includes(file.type)) return file;
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      });
    } catch {
      return file;
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of arr) {
      const processed = await maybeCompress(file);
      const filePath = pathPrefix + encodeFileName(file.name);
      const { error } = await externalSupabase.storage.from(BUCKET).upload(filePath, processed, {
        cacheControl: "3600",
        upsert: false
      });
      if (error) {
        toast({ title: `Ошибка: ${file.name}`, description: error.message, variant: "destructive" });
      } else {
        successCount++;
      }
    }
    if (successCount > 0) toast({ title: `Загружено файлов: ${successCount}` });
    setUploading(false);
    fetchFiles();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFolder = async () => {
    const cleanName = encodeFolderName(newFolderName);
    if (!cleanName) {
      toast({ title: "Некорректное имя папки", variant: "destructive" });
      return;
    }
    const keepPath = pathPrefix + cleanName + "/.keep";
    const { error } = await externalSupabase.storage.
    from(BUCKET).
    upload(keepPath, new Blob([""], { type: "text/plain" }), { upsert: true });
    if (error) {
      toast({ title: "Ошибка создания папки", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Папка «${newFolderName.trim()}» создана` });
      fetchFiles();
    }
    setNewFolderDialogOpen(false);
    setNewFolderName("");
  };

  const handleDownload = async (fileName: string) => {
    const fullPath = pathPrefix + fileName;
    const { data, error } = await externalSupabase.storage.from(BUCKET).createSignedUrl(fullPath, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Ошибка скачивания", description: error?.message ?? "Не удалось", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (fileName: string, isFolder: boolean) => {
    if (isFolder) {
      // Delete all files in folder recursively
      const folderPath = pathPrefix + fileName;
      const { data } = await externalSupabase.storage.from(BUCKET).list(folderPath, { limit: 500 });
      if (data && data.length > 0) {
        const paths = data.map((f) => `${folderPath}/${f.name}`);
        await externalSupabase.storage.from(BUCKET).remove(paths);
      }
      // Also remove .keep
      await externalSupabase.storage.from(BUCKET).remove([`${folderPath}/.keep`]);
    } else {
      const { error } = await externalSupabase.storage.from(BUCKET).remove([pathPrefix + fileName]);
      if (error) {
        toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: isFolder ? "Папка удалена" : "Файл удалён" });
    fetchFiles();
  };

  const handleRename = async () => {
    if (!targetItem || !renameValue.trim()) return;
    const newSafe = targetItem.isFolder ? encodeFolderName(renameValue) : encodeFileName(renameValue);
    if (!newSafe) {
      toast({ title: "Некорректное имя", variant: "destructive" });
      return;
    }
    const oldName = pathPrefix + targetItem.name;
    const newName = pathPrefix + newSafe;
    if (targetItem.isFolder) {
      const { data } = await externalSupabase.storage.from(BUCKET).list(pathPrefix + targetItem.name, { limit: 500 });
      const newFolderBase = pathPrefix + newSafe;
      if (data) {
        for (const f of data) {
          await externalSupabase.storage.from(BUCKET).move(
            `${pathPrefix}${targetItem.name}/${f.name}`,
            `${newFolderBase}/${f.name}`
          );
        }
      }
      await externalSupabase.storage.
      from(BUCKET).
      upload(`${newFolderBase}/.keep`, new Blob([""]), { upsert: true });
    } else {
      const { error } = await externalSupabase.storage.from(BUCKET).move(oldName, newName);
      if (error) {
        toast({ title: "Ошибка переименования", description: error.message, variant: "destructive" });
        setRenameDialogOpen(false);
        return;
      }
    }
    toast({ title: "Переименовано" });
    setRenameDialogOpen(false);
    setTargetItem(null);
    fetchFiles();
  };

  const handleMove = async () => {
    if (!targetItem || moveTarget === undefined) return;
    const oldPath = pathPrefix + targetItem.name;
    const destination = moveTarget ? moveTarget.replace(/\/+$/, "") + "/" : "";
    const newPath = destination + targetItem.name;
    const { error } = await externalSupabase.storage.from(BUCKET).move(oldPath, newPath);
    if (error) {
      toast({ title: "Ошибка перемещения", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Файл перемещён" });
      fetchFiles();
    }
    setMoveDialogOpen(false);
    setTargetItem(null);
    setMoveTarget("");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const displayName = (name: string) => {
    const ext = name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".")) : "";
    const base = name.slice(0, name.length - ext.length);
    return decodeName(base) + ext;
  };
  const displayFolderName = (name: string) => decodeSegment(name);

  return (
    <div className="space-y-1.5">
      {/* Breadcrumbs + Actions */}
      <nav className="flex items-center justify-between gap-2 flex-wrap mt-[18px]">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="w-2 h-2 rounded-full bg-[hsl(var(--blue1))]" />
          <h2 className="text-base font-semibold text-foreground mr-2">Диск компании</h2>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => navigateToBreadcrumb(0)}
            className={`transition-colors ${currentPath.length === 0 ? "text-[hsl(var(--blue1))]" : "text-muted-foreground hover:text-foreground"}`}>
            ​Главная страница 
          </button>
          {currentPath.map((segment, i) =>
          <span key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              <button
              onClick={() => navigateToBreadcrumb(i + 1)}
              className={`transition-colors ${
              i === currentPath.length - 1 ?
              "text-[hsl(var(--blue1))]" :
              "text-muted-foreground hover:text-foreground"}`
              }>
                {displayFolderName(segment)}
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs h-7 px-2.5 text-muted-foreground bg-foreground/[0.03] border-transparent hover:bg-card hover:text-[hsl(var(--blue1))]"
            onClick={() => {setNewFolderName("");setNewFolderDialogOpen(true);}}>
            
            <FolderPlus size={14} />
            Новая папка
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs h-7 px-2.5 text-muted-foreground bg-foreground/[0.03] border-transparent hover:bg-card hover:text-[hsl(var(--blue1))]"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}>
            
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Загрузка…" : "Загрузить"}
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
        </div>
      </nav>

      {/* Dropzone */}
      {!loading && folders.length === 0 && files.length === 0 && (
        <div
          onDragOver={(e) => {e.preventDefault();setDragOver(true);}}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {e.preventDefault();setDragOver(false);if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files);}}
          className={`border-2 border-dashed rounded-2xl p-5 mt-[50%] text-center transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/30"}`
          }
          onClick={() => fileInputRef.current?.click()}>
          
          <FolderUp size={28} className="mx-auto text-muted-foreground/50 mb-1.5" />
          <p className="text-xs text-muted-foreground">
            Перетащите файлы сюда или нажмите для выбора
          </p>
        </div>
      )}

      {/* File list */}
      <div className="border border-border rounded-2xl overflow-hidden bg-card">
        <div className="grid grid-cols-[1fr_100px_100px_80px] gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">Название</span>
          <span className="text-xs text-muted-foreground">Размер</span>
          <span className="text-xs text-muted-foreground">Дата</span>
          <span className="text-xs text-muted-foreground text-right">Действия</span>
        </div>

        {loading ?
        <div className="px-4 py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-48 h-1 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--blue1))]"
                style={{
                  width: `${loadProgress}%`,
                  transition: loadProgress === 0 ? 'none' : loadProgress < 70 ? 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'width 0.25s ease-out',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground animate-fade-in">Загрузка…</p>
          </div> :
        folders.length === 0 && files.length === 0 ?
        <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">Пусто</p>
          </div> :

        <div>
            {/* Folders */}
            {folders.filter((folder) => {
              const fullPath = pathPrefix + folder.name;
              return canAccessFolder(fullPath, folderPermissions, userProfile);
            }).map((folder) =>
          <div
            key={`folder-${folder.name}`}
            className="grid grid-cols-[1fr_100px_100px_80px] gap-4 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0 group cursor-pointer"
            onDoubleClick={() => navigateToFolder(folder.name)}>
            
                <div
              className="flex items-center gap-3 min-w-0"
              onClick={() => navigateToFolder(folder.name)}>
              
                  <Folder size={18} className="text-[hsl(var(--blue1))] shrink-0" />
                  <span className="text-sm truncate text-[hsl(var(--blue1))] font-normal">{displayFolderName(folder.name)}</span>
                </div>
                <span className="text-xs text-muted-foreground self-center">—</span>
                <span className="text-xs text-muted-foreground self-center">
                  {formatDate(folder.created_at)}
                </span>
                <div className="flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 hover:rotate-90">
                        <MoreVertical size={14} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                    setTargetItem({ name: folder.name, isFolder: true });
                    setRenameValue(displayFolderName(folder.name));
                    setRenameDialogOpen(true);
                  }}>
                        <Pencil size={14} className="mr-2" /> Переименовать
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setPermissionsFolderPath(pathPrefix + folder.name);
                            setPermissionsFolderName(displayFolderName(folder.name));
                            setPermissionsOpen(true);
                          }}>
                            <Shield size={14} className="mr-2" /> Права доступа
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 [&>svg]:!text-destructive"
                    onClick={() => handleDelete(folder.name, true)}>
                    
                        <Trash2 size={14} className="mr-2" /> Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
          )}

            {/* Files */}
            {files.map((file) =>
          <div
            key={file.name}
            className="grid grid-cols-[1fr_100px_100px_80px] gap-4 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b border-border last:border-b-0 group">
            
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(file.name)}
                  <button
                onClick={() => handleDownload(file.name)}
                className="text-sm truncate text-left hover:text-[hsl(var(--blue1))] transition-colors cursor-pointer">
                
                    {displayName(file.name)}
                  </button>
                </div>
                <span className="text-xs text-muted-foreground self-center">
                  {formatFileSize(file.metadata?.size)}
                </span>
                <span className="text-xs text-muted-foreground self-center">
                  {formatDate(file.created_at)}
                </span>
                <div className="flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 hover:rotate-90">
                        <MoreVertical size={14} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file.name)}>
                        <Download size={14} className="mr-2" /> Скачать
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                    setTargetItem({ name: file.name, isFolder: false });
                    setRenameValue(displayName(file.name));
                    setRenameDialogOpen(true);
                  }}>
                        <Pencil size={14} className="mr-2" /> Переименовать
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                    setTargetItem({ name: file.name, isFolder: false });
                    setMoveTarget("");
                    setMoveDialogOpen(true);
                  }}>
                        <Move size={14} className="mr-2" /> Переместить
                      </DropdownMenuItem>
                      <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10 [&>svg]:!text-destructive"
                    onClick={() => handleDelete(file.name, false)}>
                    
                        <Trash2 size={14} className="mr-2" /> Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
          )}
          </div>
        }
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Новая папка</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Название папки"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>Отмена</Button>
            <Button className="bg-[hsl(var(--blue1))] text-white hover:bg-[hsl(var(--blue1))]/90" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Переименовать</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Новое название"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()} />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Отмена</Button>
            <Button className="bg-[hsl(var(--blue1))] text-white hover:bg-[hsl(var(--blue1))]/90" onClick={handleRename} disabled={!renameValue.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переместить файл</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">
            Укажите путь назначения (например: <code>finance/reports</code>). Оставьте пустым для корня.
          </p>
          <Input
            placeholder="Путь назначения"
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMove()}
            autoFocus />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Отмена</Button>
            <Button className="bg-[hsl(var(--blue1))] text-white hover:bg-[hsl(var(--blue1))]/90" onClick={handleMove}>Переместить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Permissions Modal */}
      <FolderPermissionsModal
        open={permissionsOpen}
        onOpenChange={handlePermissionsChange}
        folderPath={permissionsFolderPath}
        folderDisplayName={permissionsFolderName}
      />
    </div>);

};

export default CompanyDisk;