import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Alert } from '../components';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsLoading(true);
    try {
      await login(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Painel Financiamento</h1>
          <p className="mt-2 text-gray-600">Acesse sua conta para continuar</p>
        </div>

        <div className="card p-6">
          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" className="w-full" loading={isLoading}>
              Entrar
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Credenciais de teste:</p>
            <p className="font-mono text-xs mt-1">admin@imobiliaria.com / Admin@123</p>
            <p className="font-mono text-xs">corretor@imobiliaria.com / Corretor@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}