'use client';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container max-w-[1200px] mx-auto px-4 lg:px-6">
        <div className="flex h-14 items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © 2024 CareScheduler. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              도움말
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              개인정보처리방침
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              이용약관
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}