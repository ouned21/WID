export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: '#f0f2f8' }}>
      <div className="w-full max-w-[380px] space-y-6">{children}</div>
    </div>
  );
}
