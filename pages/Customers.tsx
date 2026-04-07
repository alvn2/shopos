import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/common/Layout';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, Customer } from '../types';
import { api } from '../services/api';
import {
    Users, Plus, Search, X, Phone, Mail, CreditCard,
    ChevronDown, ChevronUp, RefreshCw, DollarSign, FileText, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const Customers: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN;
    const isWorker = user?.role === UserRole.WORKER;

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [ledger, setLedger] = useState<any[]>([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    // New customer form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [addingSaving, setAddingSaving] = useState(false);

    // Payment form
    const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentRef, setPaymentRef] = useState('');
    const [paymentSaving, setPaymentSaving] = useState(false);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.customers.getAll();
            setCustomers(data);
        } catch (err) {
            console.error('Failed to load customers:', err);
            toast.error('Failed to load customers');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const toggleExpand = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            setLedger([]);
            return;
        }
        setExpandedId(id);
        setLedgerLoading(true);
        try {
            const data = await api.customers.getLedger(id);
            setLedger(data);
        } catch {
            toast.error('Failed to load ledger');
        } finally {
            setLedgerLoading(false);
        }
    };

    const handleAddCustomer = async () => {
        if (!newName.trim()) {
            toast.error('Customer name is required');
            return;
        }
        setAddingSaving(true);
        try {
            await api.customers.create({ name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim(), notes: newNotes.trim() });
            toast.success('Customer added');
            setNewName(''); setNewPhone(''); setNewEmail(''); setNewNotes('');
            setShowAddForm(false);
            await fetchCustomers();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to add customer');
        } finally {
            setAddingSaving(false);
        }
    };

    const handlePayment = async () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0 || !paymentCustomerId) {
            toast.error('Enter a valid payment amount');
            return;
        }
        setPaymentSaving(true);
        try {
            await api.customers.recordPayment(paymentCustomerId, { amount, reference: paymentRef.trim() });
            toast.success(`Payment of KES ${amount.toLocaleString()} recorded`);
            setPaymentCustomerId(null);
            setPaymentAmount('');
            setPaymentRef('');
            await fetchCustomers();
            // Refresh ledger if expanded
            if (expandedId === paymentCustomerId) {
                const data = await api.customers.getLedger(paymentCustomerId);
                setLedger(data);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to record payment');
        } finally {
            setPaymentSaving(false);
        }
    };

    const filtered = useMemo(() => {
        if (!searchTerm) return customers;
        const s = searchTerm.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(s) ||
            (c.phone || '').toLowerCase().includes(s) ||
            (c.email || '').toLowerCase().includes(s)
        );
    }, [customers, searchTerm]);

    const totalCredit = customers.reduce((sum, c) => sum + (c.total_credit || 0), 0);

    return (
        <Layout title="Customers">
            <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-enter">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 flex items-center gap-3">
                            <div className="p-2.5 bg-teal-100 dark:bg-teal-900/40 rounded-xl text-teal-600 dark:text-teal-400">
                                <Users size={24} />
                            </div>
                            Customer Profiles
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            <span className="text-slate-900 dark:text-white font-bold">{customers.length}</span> customers
                            {totalCredit > 0 && <span className="ml-2 text-rose-500 font-bold">• KES {totalCredit.toLocaleString()} outstanding</span>}
                        </p>
                    </div>
                    {!isWorker && (
                        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary flex items-center gap-2">
                            <Plus size={18} />
                            Add Customer
                        </button>
                    )}
                </div>

                {/* Add Customer Form */}
                {showAddForm && (
                    <div className="card-modern p-5 space-y-4 animate-slide-up">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">New Customer</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input type="text" placeholder="Full Name *" value={newName} onChange={e => setNewName(e.target.value)} className="input-modern" autoFocus />
                            <input type="tel" placeholder="Phone Number" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="input-modern" />
                            <input type="email" placeholder="Email (optional)" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input-modern" />
                            <input type="text" placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="input-modern" />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowAddForm(false)} className="btn-secondary !py-2">Cancel</button>
                            <button onClick={handleAddCustomer} disabled={addingSaving} className="btn-primary !py-2">
                                {addingSaving ? <RefreshCw size={16} className="animate-spin mr-2" /> : null}
                                Save Customer
                            </button>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                    <input type="text" placeholder="Search customers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-modern !pl-12" />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Customer List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p className="font-medium">Loading customers...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 card-modern p-8">
                            <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {searchTerm ? 'No customers match your search' : 'No customers yet'}
                            </p>
                            {!searchTerm && <p className="text-sm text-slate-500 mt-1">Add your first customer above</p>}
                        </div>
                    ) : (
                        filtered.map(customer => (
                            <div key={customer.id} className="card-modern overflow-hidden">
                                <button onClick={() => toggleExpand(customer.id)} className="w-full p-5 text-left">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-extrabold text-lg text-slate-900 dark:text-white leading-tight">{customer.name}</div>
                                            <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                                                {customer.phone && (
                                                    <span className="flex items-center gap-1"><Phone size={13} />{customer.phone}</span>
                                                )}
                                                {customer.email && (
                                                    <span className="flex items-center gap-1"><Mail size={13} />{customer.email}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Credit</div>
                                                <div className={`text-lg font-black ${customer.total_credit > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                    KES {(customer.total_credit || 0).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-slate-400">
                                                {expandedId === customer.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick stats */}
                                    <div className="flex gap-4 mt-3">
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                                            <DollarSign size={11} className="inline mr-1" />
                                            Total: KES {(customer.total_purchases || 0).toLocaleString()}
                                        </span>
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                            Since {new Date(customer.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded — Ledger Details */}
                                {expandedId === customer.id && (
                                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-5 space-y-4 animate-slide-up">
                                        {/* Payment Action */}
                                        {!isWorker && customer.total_credit > 0 && (
                                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200/50 dark:border-green-800/50">
                                                {paymentCustomerId === customer.id ? (
                                                    <div className="space-y-3">
                                                        <div className="text-sm font-bold text-green-700 dark:text-green-300">Record Payment</div>
                                                        <div className="flex gap-2">
                                                            <input type="number" placeholder="Amount (KES)" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="input-modern flex-1 !py-2" autoFocus />
                                                            <input type="text" placeholder="Ref#" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="input-modern w-32 !py-2" />
                                                        </div>
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setPaymentCustomerId(null)} className="btn-secondary !py-1.5 !px-3 !text-xs">Cancel</button>
                                                            <button onClick={handlePayment} disabled={paymentSaving} className="btn-primary !py-1.5 !px-4 !text-xs">
                                                                {paymentSaving ? <RefreshCw size={12} className="animate-spin mr-1" /> : null}
                                                                Submit Payment
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setPaymentCustomerId(customer.id)} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition-colors">
                                                        <CreditCard size={16} />
                                                        Record Payment (Owes KES {customer.total_credit.toLocaleString()})
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Ledger */}
                                        <div>
                                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <FileText size={13} />
                                                Transaction History
                                            </div>
                                            {ledgerLoading ? (
                                                <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                                                    <RefreshCw size={14} className="animate-spin" /> Loading...
                                                </div>
                                            ) : ledger.length === 0 ? (
                                                <p className="text-sm text-slate-400 py-4 text-center">No transactions yet</p>
                                            ) : (
                                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                    {ledger.map(entry => (
                                                        <div key={entry.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/50 dark:border-slate-700/50 text-sm">
                                                            <div className="flex items-center gap-3">
                                                                {entry.type === 'payment' ? (
                                                                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                                        <ArrowDownRight size={14} className="text-green-600 dark:text-green-400" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                                                                        <ArrowUpRight size={14} className="text-rose-600 dark:text-rose-400" />
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="font-bold text-slate-900 dark:text-white capitalize">{entry.type}</div>
                                                                    <div className="text-xs text-slate-400">{new Date(entry.date).toLocaleDateString()} • {entry.recorded_by}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`font-bold ${entry.type === 'payment' ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                    {entry.type === 'payment' ? '-' : '+'}KES {entry.amount.toLocaleString()}
                                                                </div>
                                                                <div className="text-xs text-slate-400">Bal: KES {entry.balance.toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default Customers;
