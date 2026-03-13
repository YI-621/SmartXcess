import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Search, Upload, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAssessmentsWithQuestions } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Assessment } from "@/lib/assessment";

const statusStyles: Record<string, string> = {
  Moderating: "bg-primary/10 text-primary border-primary/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Done: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

type UploadPreviewAssessment = Assessment & { isTemporary?: boolean };

const Assessments = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [moduleCode, setModuleCode] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedModeratingAssessment, setSelectedModeratingAssessment] = useState<UploadPreviewAssessment | null>(null);
  const [pendingUploads, setPendingUploads] = useState<UploadPreviewAssessment[]>([]);
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

  const { data: dbAssessments, isLoading } = useAssessmentsWithQuestions();
  const assessments: UploadPreviewAssessment[] = [...pendingUploads, ...(dbAssessments ?? [])];

  const filtered = assessments.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.lecturer.toLowerCase().includes(search.toLowerCase()) ||
      a.course.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !user || !moduleCode.trim()) return;
    if (!apiBaseUrl) {
      toast({
        title: "Backend URL not configured",
        description: "Set VITE_API_BASE_URL for production deployment.",
        variant: "destructive",
      });
      return;
    }

    const tempId = `temp-upload-${Date.now()}`;
    const previewTitle = pdfName.trim() || selectedFile.name;
    const previewDate = new Date().toLocaleDateString();

    setPendingUploads((prev) => [
      {
        id: tempId,
        title: previewTitle,
        course: moduleCode.trim().toUpperCase(),
        lecturer: "",
        date: previewDate,
        status: "Moderating",
        questions: [],
        overallScore: -1,
        flagged: false,
        isTemporary: true,
      },
      ...prev,
    ]);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("module_code", moduleCode.trim().toUpperCase());
      formData.append("uploaded_by", user.id);
      if (pdfName.trim()) {
        formData.append("pdf_name", pdfName.trim());
      }
      formData.append("file", selectedFile);

      const response = await fetch(`${apiBaseUrl}/api/moderation/analyze`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail ?? payload?.reason ?? "Analysis failed");
      }

      toast({
        title: "Assessment processed",
        description: `Analysis completed for ${selectedFile.name}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });
      queryClient.invalidateQueries({ queryKey: ["assessment"] });

      setUploadDialogOpen(false);
      setModuleCode("");
      setPdfName("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setPendingUploads((prev) => prev.filter((assessment) => assessment.id !== tempId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Assessments</h2>
          <p className="text-sm text-muted-foreground mt-1">All submitted assessments for moderation</p>
        </div>
        <Button className="gap-2" onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Assessment
        </Button>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Assessment</DialogTitle>
            <DialogDescription>Upload an assessment file with its module code for moderation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moduleCode">Module Code</Label>
              <Input
                id="moduleCode"
                placeholder="e.g. BUS201"
                value={moduleCode}
                onChange={(e) => setModuleCode(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">The moderator assigned to this module will review your assessment.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdfName">PDF Name</Label>
              <Input
                id="pdfName"
                placeholder="e.g. Final Exam BUS201"
                value={pdfName}
                onChange={(e) => setPdfName(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Optional. This name will be used for the saved assessment title.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessmentFile">Assessment File</Label>
              <Input
                id="assessmentFile"
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf"
              />
            </div>
            {selectedFile && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium text-card-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleUploadSubmit}
              disabled={uploading || !selectedFile || !moduleCode.trim()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Submit Assessment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedModeratingAssessment}
        onOpenChange={(open) => {
          if (!open) setSelectedModeratingAssessment(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Moderation In Progress</DialogTitle>
            <DialogDescription>
              This assessment is currently being moderated by the system.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-5 text-center space-y-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium text-card-foreground">
              {selectedModeratingAssessment?.title ?? "Assessment"}
            </p>
            <p className="text-xs text-muted-foreground">
              Please wait while SmartXcess analyzes and prepares the moderation outcome.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search assessments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Title", "Module", "Date", "Questions", "Score", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => (
                (() => {
                  const canOpen = a.status === "Moderating" || !a.isTemporary;
                  return (
                <tr
                  key={a.id}
                  className={cn(
                    "transition-colors",
                    canOpen ? "hover:bg-muted/30 cursor-pointer" : "opacity-80"
                  )}
                  onClick={() => {
                    if (a.status === "Moderating") {
                      setSelectedModeratingAssessment(a);
                      return;
                    }

                    if (!a.isTemporary) {
                      navigate(`/assessment-detail/${encodeURIComponent(a.id)}`);
                    }
                  }}
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-card-foreground">{a.title}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.course}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.date}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.questions.length}</td>
                  <td className="px-5 py-3.5">
                    {a.overallScore < 0 ? (
                      <span className="text-sm font-bold font-mono text-muted-foreground">--</span>
                    ) : (
                      <span className={cn("text-sm font-bold font-mono", a.overallScore >= 70 ? "text-success" : a.overallScore >= 50 ? "text-warning" : "text-destructive")}>
                        {a.overallScore}%
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                      {a.status}
                    </Badge>
                  </td>
                </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No assessments found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Assessments;
