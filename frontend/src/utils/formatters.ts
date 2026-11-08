import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Não informado';
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Não informado';
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

export function maskCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(9)}`;
}

export function unmaskCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function formatRG(rg: string): string {
  return rg.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
}

export function maskRG(rg: string): string {
  const cleaned = rg.replace(/\D/g, '');
  if (cleaned.length < 4) return rg;
  return `${cleaned.slice(0, 2)}.***.***-${cleaned.slice(-1)}`;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return phone;
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-****`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-****`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : '***';
  return `${maskedLocal}@${domain}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Não informado';
  return `${(value * 100).toFixed(2)}%`;
}

export function getStatusBadge(status: string): { class: string; label: string } {
  const statusMap: Record<string, { class: string; label: string }> = {
    PENDING: { class: 'badge-warning', label: 'Aguardando' },
    PROCESSING: { class: 'badge-info', label: 'Processando' },
    COMPLETED: { class: 'badge-success', label: 'Concluída' },
    FAILED: { class: 'badge-danger', label: 'Erro' },
    UNAVAILABLE: { class: 'badge-gray', label: 'Indisponível' },
    EXPIRED: { class: 'badge-gray', label: 'Expirada' },
    ACTIVE: { class: 'badge-success', label: 'Ativo' },
    INACTIVE: { class: 'badge-gray', label: 'Inativo' },
    ARCHIVED: { class: 'badge-gray', label: 'Arquivado' },
    GIVEN: { class: 'badge-success', label: 'Concedido' },
    REVOKED: { class: 'badge-danger', label: 'Revogado' },
    APPROVED: { class: 'badge-success', label: 'Aprovado' },
    DENIED: { class: 'badge-danger', label: 'Negado' },
    REQUIRES_REVIEW: { class: 'badge-warning', label: 'Requer Análise' },
  };

  return statusMap[status] || { class: 'badge-gray', label: status };
}

export function getConsultationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    approved: 'Aprovado',
    denied: 'Negado',
    pending: 'Pendente',
    requires_review: 'Requer Análise',
    error: 'Erro',
  };
  return labels[status] || status;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}