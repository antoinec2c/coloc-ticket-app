import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureDefaultData } from '@/lib/initDb';
import { calculateBalances } from '@/lib/balanceCalculator';
import { Member, Expense, Settlement } from '@/types';

export async function GET() {
  try {
    await ensureDefaultData();

    const members = await prisma.member.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const expenses = await prisma.expense.findMany({
      include: {
        payer: true,
        items: true,
      },
      orderBy: { date: 'desc' },
    });

    const settlements = await prisma.settlement.findMany({
      include: {
        fromMember: true,
        toMember: true,
      },
      orderBy: { date: 'desc' },
    });

    // Transformer en types propres
    const typedMembers: Member[] = members.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      color: m.color,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));

    const typedExpenses: Expense[] = expenses.map((e) => ({
      id: e.id,
      title: e.title,
      store: e.store,
      date: e.date.toISOString(),
      totalAmount: e.totalAmount,
      colocAmount: e.colocAmount,
      persoAmount: e.persoAmount,
      fileType: e.fileType,
      receiptImage: e.receiptImage,
      notes: e.notes,
      payerId: e.payerId,
      payer: {
        id: e.payer.id,
        name: e.payer.name,
        avatar: e.payer.avatar,
        color: e.payer.color,
      },
      items: e.items.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        isPersonal: i.isPersonal,
        category: i.category,
      })),
      createdAt: e.createdAt.toISOString(),
    }));

    const typedSettlements: Settlement[] = settlements.map((s) => ({
      id: s.id,
      amount: s.amount,
      date: s.date.toISOString(),
      notes: s.notes,
      fromMemberId: s.fromMemberId,
      fromMember: {
        id: s.fromMember.id,
        name: s.fromMember.name,
        avatar: s.fromMember.avatar,
        color: s.fromMember.color,
      },
      toMemberId: s.toMemberId,
      toMember: {
        id: s.toMember.id,
        name: s.toMember.name,
        avatar: s.toMember.avatar,
        color: s.toMember.color,
      },
    }));

    const { balances, debts, totalColocExpenses } = calculateBalances(
      typedMembers,
      typedExpenses,
      typedSettlements
    );

    return NextResponse.json({
      members: typedMembers,
      expenses: typedExpenses,
      settlements: typedSettlements,
      balances,
      debts,
      totalColocExpenses,
    });
  } catch (error) {
    console.error('Erreur API members:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des membres et soldes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, avatar, color } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 });
    }

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        avatar: avatar || '👤',
        color: color || '#3b82f6',
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Erreur création membre:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du colocataire' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, avatar, color } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(avatar && { avatar }),
        ...(color && { color }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur modification membre:', error);
    return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    // Vérifier si le membre a des dépenses enregistrées
    const expenseCount = await prisma.expense.count({
      where: { payerId: id },
    });

    if (expenseCount > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un colocataire ayant des dépenses enregistrées.' },
        { status: 400 }
      );
    }

    // Supprimer les éventuels règlements liés
    await prisma.settlement.deleteMany({
      where: {
        OR: [{ fromMemberId: id }, { toMemberId: id }],
      },
    });

    await prisma.member.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Colocataire supprimé' });
  } catch (error) {
    console.error('Erreur suppression membre:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
