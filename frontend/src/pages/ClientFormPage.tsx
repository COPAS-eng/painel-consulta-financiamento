import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Client } from '../types';
import { formatCPF } from '../utils/formatters';
import { Button, Input, Select, Alert } from '../components';
import toast from 'react-hot-toast';

const clientSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)'),
  rg: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, 'Telefone inválido').optional().or(z.literal('')),
  monthlyIncome: z.number().min(0).optional().nullable(),
  profession: z.string().max(100).optional().or(z.literal('')),
  maritalStatus: z.string().max(50).optional().or(z.literal('')),
  address: z.record(z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export function ClientFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (isEditing) {
      loadClient();
    }
  }, [id]);

  const loadClient = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Client>(`/clients/${id}?includeSensitive=true`);
      const client = response.data;
      reset({
        fullName: client.fullName,
        cpf: formatCPF(client.cpf),
        birthDate: client.birthDate.split('T')[0],
        rg: client.rg || '',
        email: client.email || '',
        phone: client.phone || '',
        monthlyIncome: client.monthlyIncome ? Number(client.monthlyIncome) : undefined,
        profession: client.profession || '',
        maritalStatus: client.maritalStatus || '',
        address: client.address as Record<string, unknown> || undefined,
        status: client.status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cliente');
      toast.error('Erro ao carregar cliente');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: ClientFormValues) => {
    setError('');
    setIsLoading(true);
    try {
      const payload = {
        ...data,
        cpf: data.cpf.replace(/\D/g, ''),
        monthlyIncome: data.monthlyIncome || undefined,
      };

      if (isEditing) {
        await api.patch(`/clients/${id}`, payload);
        toast.success('Cliente atualizado com sucesso');
      } else {
        await api.post('/clients', payload);
        toast.success('Cliente cadastrado com sucesso');
      }
      navigate('/clients');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cliente';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEditing && isLoading) {
    return <div className="card p-6 text-center text-gray-500">Carregando...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h1>
        <p className="text-gray-500 mt-1">{isEditing ? 'Atualize os dados do cliente' : 'Preencha os dados para cadastrar um novo cliente'}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-6" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nome Completo *" error={errors.fullName?.message} {...register('fullName')} />
          <Input label="CPF *" placeholder="000.000.000-00" error={errors.cpf?.message} {...register('cpf')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Data de Nascimento *" type="date" error={errors.birthDate?.message} {...register('birthDate')} />
          <Input label="RG" error={errors.rg?.message} {...register('rg')} />
          <Select
            label="Estado Civil"
            options={[
              { value: '', label: 'Selecione' },
              { value: 'SOLTEIRO', label: 'Solteiro(a)' },
              { value: 'CASADO', label: 'Casado(a)' },
              { value: 'DIVORCIADO', label: 'Divorciado(a)' },
              { value: 'VIUVO', label: 'Viúvo(a)' },
              { value: 'UNIAO_ESTAVEL', label: 'União Estável' },
            ]}
            error={errors.maritalStatus?.message}
            {...register('maritalStatus')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Telefone" placeholder="(11) 99999-9999" error={errors.phone?.message} {...register('phone')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Renda Mensal (R$)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            error={errors.monthlyIncome?.message}
            {...register('monthlyIncome', { valueAsNumber: true })}
          />
          <Input label="Profissão" error={errors.profession?.message} {...register('profession')} />
        </div>

        {isEditing && (
          <Select
            label="Status"
            options={[
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'INACTIVE', label: 'Inativo' },
              { value: 'ARCHIVED', label: 'Arquivado' },
            ]}
            error={errors.status?.message}
            {...register('status')}
          />
        )}

        <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading}>
            {isEditing ? 'Salvar Alterações' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </div>
  );
}