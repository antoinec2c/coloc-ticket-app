import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const colocId = searchParams.get('colocId') || undefined;

    const expenses = await prisma.expense.findMany({
      where: colocId ? { colocationId: colocId } : {},
      include: {
        payer: true,
        items: true,
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Erreur GET expenses:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des dépenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      store,
      date,
      payerId,
      items,
      fileType,
      receiptImage,
      notes,
      colocationId,
    } = body;

    if (!title || !payerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Titre, payeur et articles obligatoires' },
        { status: 400 }
      );
    }

    // Calculer les montants coloc et perso à partir des articles ventilés
    let colocAmount = 0;
    let persoAmount = 0;

    const itemsToCreate = items.map((item: any) => {
      const price = Number(item.totalPrice) || (Number(item.quantity || 1) * Number(item.unitPrice || 0));
      const isPersonal = Boolean(item.isPersonal);

      if (isPersonal) {
        persoAmount += price;
      } else {
        colocAmount += price;
      }

      return {
        name: item.name || 'Article',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || price,
        totalPrice: Math.round(price * 100) / 100,
        isPersonal,
        category: item.category || 'Alimentation',
      };
    });

    colocAmount = Math.round(colocAmount * 100) / 100;
    persoAmount = Math.round(persoAmount * 100) / 100;
    const totalAmount = Math.round((colocAmount + persoAmount) * 100) / 100;

    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        store: store?.trim() || null,
        date: date ? new Date(date) : new Date(),
        totalAmount,
        colocAmount,
        persoAmount,
        fileType: fileType || 'receipt_photo',
        receiptImage: receiptImage || null,
        notes: notes || null,
        colocationId: colocationId || null,
        payerId,
        items: {
          create: itemsToCreate,
        },
      },
      include: {
        payer: true,
        items: true,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Erreur POST expense:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la dépense' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');
    const colocId = searchParams.get('colocId') || undefined;

    // Réinitialiser / vider toutes les dépenses (d'une coloc ou globales)
    if (clearAll === 'true') {
      const whereClause = colocId ? { colocationId: colocId } : {};

      // Supprimer les items associés
      const expensesToDelete = await prisma.expense.findMany({
        where: whereClause,
        select: { id: true },
      });
      const expenseIds = expensesToDelete.map((e) => e.id);

      await prisma.expenseItem.deleteMany({
        where: { expenseId: { in: expenseIds } },
      });
      await prisma.expense.deleteMany({
        where: whereClause,
      });
      await prisma.settlement.deleteMany({
        where: whereClause,
      });

      return NextResponse.json({ success: true, message: 'Toutes les dépenses ont été réinitialisées.' });
    }

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE expense:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la dépense' },
      { status: 500 }
    );
  }
}
