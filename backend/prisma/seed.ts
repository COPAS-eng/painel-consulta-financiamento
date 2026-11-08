import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { MockPartnerAdapter } from '../src/integrations/mockAdapter.js';
import { partnerRegistry } from '../src/integrations/partnerAdapter.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  const adminEmail = 'admin@imobiliaria.com';
  const adminPassword = 'Admin@123';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'Administrador do Sistema',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log('Usuário admin criado:', adminEmail);
  } else {
    console.log('Usuário admin já existe');
  }

  const brokerEmail = 'corretor@imobiliaria.com';
  const brokerPassword = 'Corretor@123';

  const existingBroker = await prisma.user.findUnique({ where: { email: brokerEmail } });
  if (!existingBroker) {
    const passwordHash = await bcrypt.hash(brokerPassword, 12);
    await prisma.user.create({
      data: {
        email: brokerEmail,
        passwordHash,
        fullName: 'Corretor Exemplo',
        role: 'BROKER',
        status: 'ACTIVE',
      },
    });
    console.log('Usuário corretor criado:', brokerEmail);
  } else {
    console.log('Usuário corretor já existe');
  }

  const mockPartner = await prisma.partnerConfig.upsert({
    where: { name: 'mock' },
    create: {
      name: 'mock',
      displayName: 'Parceiro de Teste (Simulado)',
      baseUrl: 'http://localhost:3001/mock',
      authType: 'none',
      credentials: {},
      isActive: true,
      isTestEnv: true,
      rateLimit: 60,
      requiredFields: ['fullName', 'cpf', 'birthDate', 'monthlyIncome', 'propertyValue', 'downPayment'],
    },
    update: {
      isActive: true,
      isTestEnv: true,
    },
  });

  partnerRegistry.register(new MockPartnerAdapter(mockPartner));
  console.log('Parceiro mock registrado');

  console.log('Seed concluído!');
  console.log('\nCredenciais de acesso:');
  console.log('Admin:', adminEmail, '/', adminPassword);
  console.log('Corretor:', brokerEmail, '/', brokerPassword);
}

main()
  .catch(e => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });