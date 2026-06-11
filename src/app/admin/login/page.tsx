import { LoginForm } from '@/components/admin/login-form';

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="dark flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
      <LoginForm initialError={error} />
    </main>
  );
}
