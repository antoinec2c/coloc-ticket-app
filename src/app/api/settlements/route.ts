import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromMemberId, toMemberId, amount, notes } = body;

    if (!fromMemberId || !toMemberId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Membres et montant supérieur à 0 obligatoires' },
        { status: 400 }
      );
    }

    const settlement = await prisma.settlement.create({
      data: {
        fromMemberId,
        toMemberId,
        amount: Math.round(Number(amount) * 100) / 100,
        notes: notes || 'Remboursement pot commun',
      },
      include: {
        fromMember: true,
        toMember: true,
      },
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error('Erreur POST settlement:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement du remboursement' },
      { status: 500 }
    );
  }
}
