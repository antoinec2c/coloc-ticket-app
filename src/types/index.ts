export interface Colocation {
  id: string;
  name: string;
  code: string;
  createdAt?: string;
  members?: Member[];
}

export interface Member {
  id: string;
  name: string;
  avatar: string; // Emoji ou lettre
  color: string;  // Hex color pour badges et bordures
  role?: string;
  colocationId?: string | null;
  createdAt?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isPersonal: boolean; // false = Coloc (partagé), true = Perso (gardé pour soi)
  category?: string;
}

export interface Expense {
  id: string;
  title: string;
  store?: string | null;
  date: string;
  totalAmount: number;
  colocAmount: number;
  persoAmount: number;
  fileType?: string | null; // "receipt_photo", "invoice_pdf", "manual"
  receiptImage?: string | null;
  notes?: string | null;
  colocationId?: string | null;
  payerId: string;
  payer: Member;
  items: ExpenseItem[];
  createdAt?: string;
}

export interface Settlement {
  id: string;
  amount: number;
  date: string;
  notes?: string | null;
  colocationId?: string | null;
  fromMemberId: string;
  fromMember: Member;
  toMemberId: string;
  toMember: Member;
}

export interface MemberBalance {
  member: Member;
  totalPaid: number;      // Ce qu'il a payé de sa poche pour la coloc
  totalShare: number;     // Sa part de toutes les dépenses coloc
  netBalance: number;     // totalPaid - totalShare + (reçus - versés)
}

export interface Debt {
  from: Member;
  to: Member;
  amount: number;
}

export interface ExtractedReceipt {
  store: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isPersonal?: boolean;
    category?: string;
  }>;
  total: number;
  confidenceNotes?: string;
}
