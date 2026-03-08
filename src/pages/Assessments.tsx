import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Search, Upload, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAssessmentsWithQuestions, useLogActivity } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  Pending: "bg-warning/10 text-warning border-warning/20",
  Reviewed: "bg-info/10 text-info border-info/20",
  Approved: "bg-success/10 text-success border-success/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const Assessments = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const logActivity = useLogActivity();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [moduleCode, setModuleCode] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: dbAssessments, isLoading } = useAssessmentsWithQuestions();
  const assessments = dbAssessments ?? [];

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

    setUploading(true);
    try {
      // 1. Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("assessments")
        .upload(fileName, selectedFile);
      if (uploadError) throw uploadError;

      // 2. Find a moderator assigned to this module code
      const { data: moderatorMapping } = await supabase
        .from("moderator_modules")
        .select("user_id")
        .eq("module_code", moduleCode.trim().toUpperCase())
        .limit(1)
        .maybeSingle();

      // 3. Create assessment record
      const { data: newAssessment, error } = await supabase
        .from("assessments")
        .insert({
          title: selectedFile.name.replace(/\.[^/.]+$/, ""),
          course: moduleCode.trim().toUpperCase(),
          module_code: moduleCode.trim().toUpperCase(),
          lecturer_id: user.id,
          moderator_id: moderatorMapping?.user_id ?? null,
          file_url: fileName,
          status: "Pending",
        })
        .select()
        .single();

      if (error) throw error;

      // 4. Trigger automated moderation via edge function
      toast({
        title: "Assessment uploaded",
        description: "Running automated moderation analysis...",
      });

      try {
        const { data: modResult, error: modError } = await supabase.functions.invoke("moderate-assessment", {
          body: { assessment_id: newAssessment.id },
        });
        if (modError) {
          console.error("Moderation error:", modError);
          toast({
            title: "Moderation partially failed",
            description: "File uploaded but automated analysis encountered an error. It can be re-triggered later.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Moderation complete",
            description: `${modResult.questions} questions analyzed. Overall score: ${modResult.overall_score}%`,
          });
        }
      } catch (modErr) {
        console.error("Moderation invocation error:", modErr);
      }

      logActivity.mutate({
        type: "upload",
        description: `${newAssessment.title} uploaded for ${moduleCode.toUpperCase()}`,
        assessmentId: newAssessment.id,
      });

      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["assessments-full"] });

      setUploadDialogOpen(false);
      setModuleCode("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
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
              <Label htmlFor="assessmentFile">Assessment File</Label>
              <Input
                id="assessmentFile"
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
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
                <tr
                  key={a.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/assessment-detail?id=${a.id}`)}
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-card-foreground">{a.title}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.course}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.date}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{a.questions.length}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn("text-sm font-bold font-mono", a.overallScore >= 70 ? "text-success" : a.overallScore >= 50 ? "text-warning" : "text-destructive")}>
                      {a.overallScore}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={cn("text-[10px] font-medium border", statusStyles[a.status])}>
                      {a.status}
                    </Badge>
                  </td>
                </tr>
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
