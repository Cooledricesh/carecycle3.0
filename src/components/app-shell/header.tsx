'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetTitle,
  SheetDescription 
} from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-4 px-4 lg:px-6">
        {/* Mobile menu button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="lg:hidden h-11 w-11 p-0 border-border/60 hover:bg-accent hover:border-border"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <VisuallyHidden>
              <SheetTitle>Navigation Menu</SheetTitle>
              <SheetDescription>
                Main navigation menu for the application
              </SheetDescription>
            </VisuallyHidden>
            <Sidebar onNavigate={() => {
              // Add slight delay for smoother UX before closing
              setTimeout(() => setIsOpen(false), 150);
            }} />
          </SheetContent>
        </Sheet>

        {/* Spacer */}
        <div className="flex-1" />
      </div>
    </header>
  );
}