import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const sanitizeInput = (input: string) => input.replace(/['";<>=]/g, "");
type AppRole = "admin" | "moderator" | "lecturer";
const ACTIVE_ROLE_STORAGE_KEY = "smartxcess.activeRole";
const ROLE_CHANGE_EVENT = "smartxcess-role-changed";

const sendAuditLog = async (action: string, documentName = "N/A", attemptEmail?: string) => {
  try {
    let targetEmail = attemptEmail;

    if (!targetEmail) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) targetEmail = user.email;
    }

    if (!targetEmail) return;

    const { error } = await supabase.functions.invoke("audit-logger", {
      body: { userEmail: targetEmail, action, documentName },
    });

    if (error) throw error;
  } catch (err) {
    console.error("Failed to send audit log:", err);
  }
};

export default function Auth() {
  const [view, setView] = useState<"auth" | "setup-2fa" | "verify-2fa" | "choose-role">("auth");
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [moduleCode, setModuleCode] = useState("");

  const [mfaCode, setMfaCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const emailRedirectTo = new URL(`${import.meta.env.BASE_URL}#/auth`, window.location.origin).toString();

  const resetToAuthView = () => {
    setView("auth");
    setMfaCode("");
    setFactorId("");
    setQrCode("");
    setAvailableRoles([]);
    setLoading(false);
  };

  const getLandingRoute = (role: AppRole) => {
    if (role === "moderator") return "/moderate";
    if (role === "admin") return "/admin";
    return "/dashboard";
  };

  const completePostMfaFlow = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast({ title: "Session error", description: "Unable to load signed-in user.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      toast({ title: "Role load failed", description: rolesError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const roles = [...new Set((rolesData ?? []).map((r) => r.role as AppRole))];
    await sendAuditLog("USER_LOGIN_SUCCESS", "System Access", email || user.email || undefined);

    if (roles.length > 1) {
      setAvailableRoles(roles);
      setView("choose-role");
      setLoading(false);
      return;
    }

    const selected = roles[0] ?? "lecturer";
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, selected);
    window.dispatchEvent(new Event(ROLE_CHANGE_EVENT));
    navigate(getLandingRoute(selected));
  };

  const chooseRoleAndContinue = (role: AppRole) => {
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
    window.dispatchEvent(new Event(ROLE_CHANGE_EVENT));
    navigate(getLandingRoute(role));
  };

  const check2FA = async () => {
    const { data: levelData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();

    if (levelData?.currentLevel === "aal2") {
      await completePostMfaFlow();
      return;
    }

    if (factors?.totp?.length) {
      setFactorId(factors.totp[0].id);
      setView("verify-2fa");
      setLoading(false);
      return;
    }

    await setup2FA();
  };

  const setup2FA = async () => {
    const { data: existingFactors } = await supabase.auth.mfa.listFactors();
    if (existingFactors?.totp?.length) {
      for (const factor of existingFactors.totp) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "SmartXcess",
      friendlyName: email,
    });

    if (error) {
      toast({ title: "2FA setup failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setView("setup-2fa");
    setLoading(false);
  };

  const verify2FA = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      toast({ title: "Error", description: challenge.error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: mfaCode,
    });

    if (verify.error) {
      toast({ title: "Invalid code", description: "The code you entered is incorrect.", variant: "destructive" });
      await sendAuditLog("2FA_FAILED", "Authentication System", email);
      setLoading(false);
      return;
    }

    toast({ title: "Success", description: "Two-factor authentication verified." });
    await completePostMfaFlow();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const normalizedMessage = error.message.toLowerCase();
        if (normalizedMessage.includes("invalid login credentials")) {
          toast({
            title: "Password incorrect",
            description: "The password you entered is incorrect. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Login failed", description: error.message, variant: "destructive" });
        }
        await sendAuditLog("LOGIN_FAILED", "Authentication System", email);
        setLoading(false);
      } else {
        await check2FA();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            department,
            module_code: moduleCode.trim().toUpperCase(),
          },
          emailRedirectTo,
        },
      });
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a verification link to confirm your account." });
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            {view === "auth" ? (
              <ClipboardCheck className="h-6 w-6 text-primary-foreground" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">SmartXcess</CardTitle>
          <CardDescription>
            {view === "auth" && (isLogin ? "Sign in to your account" : "Create a new account")}
            {view === "setup-2fa" && "Secure your account with 2FA"}
            {view === "verify-2fa" && "Two-factor authentication"}
            {view === "choose-role" && "Choose your role for this session"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === "auth" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(sanitizeInput(e.target.value))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input id="department" value={department} onChange={(e) => setDepartment(sanitizeInput(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="moduleCode">Module Code</Label>
                    <Input
                      id="moduleCode"
                      placeholder="e.g. CSC6000"
                      value={moduleCode}
                      onChange={(e) => setModuleCode(sanitizeInput(e.target.value).toUpperCase())}
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(sanitizeInput(e.target.value))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>
            </form>
          )}

          {view === "setup-2fa" && (
            <form onSubmit={verify2FA} className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app.</p>
              <div className="mx-auto w-48 h-48 border rounded-lg p-2 bg-white shadow-sm flex items-center justify-center">
                <img src={qrCode} alt="2FA QR Code" className="w-full h-full object-contain" />
              </div>

              <div className="space-y-2 text-left">
                <Label htmlFor="setup-code">Verification Code</Label>
                <Input
                  id="setup-code"
                  type="text"
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center tracking-widest text-lg"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify and Enable
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={resetToAuthView}>
                Back to Sign In
              </Button>
            </form>
          )}

          {view === "verify-2fa" && (
            <form onSubmit={verify2FA} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code from your authenticator app.</p>
                <div className="space-y-2">
                <Label htmlFor="verify-code">Verification Code</Label>
                <Input
                  id="verify-code"
                  type="text"
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center tracking-widest text-lg"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Code
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={resetToAuthView}>
                Back to Sign In
              </Button>
            </form>
          )}

          {view === "choose-role" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                You have multiple roles. Select one to continue.
              </p>
              <div className="space-y-2">
                {availableRoles.map((role) => (
                  <Button key={role} type="button" className="w-full capitalize" onClick={() => chooseRoleAndContinue(role)}>
                    Continue as {role}
                  </Button>
                ))}
              </div>
              <Button type="button" variant="ghost" className="w-full" onClick={resetToAuthView}>
                Back to Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
