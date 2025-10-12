'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Lock, FileText } from 'lucide-react';

const CORRECT_PASSWORD = 'Align@2021';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      // If user is already authenticated, redirect them away from login
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === CORRECT_PASSWORD) {
      login();
      // Use window.location.href for a full redirect.
      // This solves the race condition where the welcome page checks for auth
      // before the context has had time to update after the redirect.
      window.location.href = '/welcome';
    } else {
      setError('Incorrect password. Please try again.');
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Incorrect password.',
      });
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-login-gradient">
      <Card className="w-full max-w-md bg-black/30 backdrop-blur-lg border-red-500/20 text-white shadow-2xl rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-white/20 rounded-full p-4 w-fit mb-4">
              <FileText className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-wider">Invoice Management</CardTitle>
          <CardDescription className="text-white/70">
            Enter the password to access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 focus:ring-red-500/50 pl-10 placeholder:text-white/50"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {error && <p className="text-sm font-medium text-red-400">{error}</p>}
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-md font-semibold py-3 rounded-lg">
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
