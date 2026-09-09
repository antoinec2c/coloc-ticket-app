import { NextResponse } from 'next/server';
import { prisma, getDbErrorMessage } from '@/lib/db';

function generateColocCode(name: string): string {
  // Créer un préfixe lisible à partir du nom
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);

  const prefix = clean.length >= 3 ? clean : 'COLOC';
  const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 chiffres
  return `${prefix}-${randomSuffix}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const id = searchParams.get('id');

    if (code) {
      const normalizedCode = code.trim().toUpperCase();
      const coloc = await prisma.colocation.findUnique({
        where: { code: normalizedCode },
        include: {
          members: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!coloc) {
        return NextResponse.json({ error: 'Colocation introuvable avec ce code' }, { status: 404 });
      }

      return NextResponse.json(coloc);
    }

    if (id) {
      const coloc = await prisma.colocation.findUnique({
        where: { id },
        include: {
          members: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!coloc) {
        return NextResponse.json({ error: 'Colocation introuvable' }, { status: 404 });
      }

      return NextResponse.json(coloc);
    }

    const colocs = await prisma.colocation.findMany({
      include: {
        members: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(colocs);
  } catch (error: any) {
    console.error('Erreur GET colocs:', error);
    return NextResponse.json(
      { error: getDbErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Le nom de la colocation est requis' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Générer un code unique avec sécurité de collision
    let code = generateColocCode(trimmedName);
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.colocation.findUnique({ where: { code } });
      if (!existing) break;
      code = generateColocCode(trimmedName);
      attempts++;
    }

    const coloc = await prisma.colocation.create({
      data: {
        name: trimmedName,
        code,
      },
      include: {
        members: true,
      },
    });

    return NextResponse.json(coloc, { status: 201 });
  } catch (error: any) {
    console.error('Erreur POST coloc:', error);
    return NextResponse.json(
      { error: getDbErrorMessage(error) },
      { status: 500 }
    );
  }
}
