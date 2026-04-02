import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  LogOut, 
  LogIn, 
  User, 
  Loader2,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Send,
  Pencil,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db, signIn, logout } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
interface BucketItem {
  id: string;
  text: string;
  completed: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  completedBy?: string;
  completedByName?: string;
}

interface Comment {
  id: string;
  text: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

// --- Components ---

function CommentsSection({ itemId, user }: { itemId: string, user: FirebaseUser }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  useEffect(() => {
    if (!showComments) return;

    const q = query(
      collection(db, 'bucketItems', itemId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(newComments);
    }, (err) => {
      console.error('Comments loading error:', err);
    });

    return () => unsubscribe();
  }, [itemId, showComments]);

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addDoc(collection(db, 'bucketItems', itemId, 'comments'), {
        text: newComment.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bucketItems/${itemId}/comments`);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'bucketItems', itemId, 'comments', commentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bucketItems/${itemId}/comments/${commentId}`);
    }
  };

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const updateComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCommentId || !editingCommentText.trim()) return;

    try {
      const commentRef = doc(db, 'bucketItems', itemId, 'comments', editingCommentId);
      await updateDoc(commentRef, {
        text: editingCommentText.trim(),
      });
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bucketItems/${itemId}/comments/${editingCommentId}`);
    }
  };

  return (
    <div className="mt-4 border-t border-white/20 pt-4">
      <button
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-2 text-xs font-black text-white/80 hover:text-stitch-blue transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        {showComments ? '댓글 숨기기' : `댓글 보기 (${comments.length || '...'})`}
      </button>

      {showComments && (
        <div className="mt-4">
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3 group/comment">
                <div className="flex-1 glass-dark rounded-2xl p-3 text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-white">{comment.createdByName}</span>
                      {comment.createdBy === user.uid && (
                        <div className="flex items-center gap-2 opacity-0 group-hover/comment:opacity-100 transition-all">
                          {editingCommentId === comment.id ? (
                            <>
                              <button
                                onClick={() => updateComment()}
                                className="text-green-400 hover:text-green-300 transition-all"
                                title="Save"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEditingComment}
                                className="text-red-400 hover:text-red-300 transition-all"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditingComment(comment)}
                                className="text-white hover:text-stitch-blue transition-all"
                                title="Edit"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteComment(comment.id)}
                                className="text-white hover:text-stitch-pink transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <form onSubmit={updateComment} className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="flex-1 bg-white/20 text-white px-2 py-1 rounded outline-none border border-stitch-blue/50 font-bold"
                          autoFocus
                        />
                      </form>
                    ) : (
                      <p className="text-white leading-relaxed font-medium">{comment.text}</p>
                    )}
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-white/60 italic text-center py-2">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
            )}
          </div>

          <form onSubmit={addComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="flex-1 glass text-white placeholder:text-white/50 rounded-xl px-4 py-2 text-sm outline-none focus:border-stitch-blue/50 transition-all font-bold"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="p-2 bg-stitch-blue hover:bg-stitch-dark disabled:bg-white/10 text-white rounded-xl transition-all active:scale-90"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function BucketList() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [items, setItems] = useState<BucketItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync user profile to Firestore for isAdmin check
  useEffect(() => {
    if (user) {
      const syncUser = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            lastLogin: serverTimestamp(),
            role: 'user' // Default role, security rules prevent self-escalation
          }, { merge: true });
        } catch (err) {
          console.error('User profile sync error:', err);
        }
      };
      syncUser();
    }
  }, [user]);

  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) {
      if (isAuthReady && !user) {
        setItems([]);
        prevUserRef.current = null;
      }
      return;
    }

    // Only set listLoading if user actually changed
    if (prevUserRef.current !== user.uid) {
      setListLoading(true);
      setItems([]); // Clear items only when user changes
      prevUserRef.current = user.uid;
    }

    // We don't use orderBy in the query to avoid hiding items with null createdAt
    const q = query(collection(db, 'bucketItems'));
    
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BucketItem[];
      
      // Sort in client: null createdAt (pending writes) first, then desc by time
      const sortedItems = [...newItems].sort((a, b) => {
        const getMillis = (ts: any) => {
          if (!ts) return Date.now() + 10000; // Pending
          if (typeof ts.toMillis === 'function') return ts.toMillis();
          if (ts.seconds) return ts.seconds * 1000;
          return Date.now();
        };
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      });

      setItems(sortedItems);
      setListError(null);
      setListLoading(false);
    }, (err) => {
      console.error('List loading error:', err);
      setListError('리스트를 불러오는 중 오류가 발생했습니다. 권한이 없거나 네트워크 문제일 수 있습니다.');
      setListLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || !user || isAdding) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'bucketItems'), {
        text: newItem.trim(),
        completed: false,
        createdBy: user.uid,
        createdByName: user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
      });
      setNewItem('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bucketItems');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleComplete = async (item: BucketItem) => {
    if (!user) return;
    try {
      const itemRef = doc(db, 'bucketItems', item.id);
      await updateDoc(itemRef, {
        completed: !item.completed,
        completedBy: !item.completed ? user.uid : null,
        completedByName: !item.completed ? (user.displayName || 'Anonymous') : null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bucketItems/${item.id}`);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bucketItems', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bucketItems/${id}`);
    }
  };

  const startEditing = (item: BucketItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText('');
  };

  const updateItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingId || !editingText.trim()) return;

    try {
      const itemRef = doc(db, 'bucketItems', editingId);
      await updateDoc(itemRef, {
        text: editingText.trim(),
      });
      setEditingId(null);
      setEditingText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bucketItems/${editingId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center stitch-gradient">
        <Loader2 className="w-8 h-8 animate-spin text-stitch-blue" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center stitch-gradient p-6 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-stitch-blue opacity-20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-stitch-purple opacity-20 blur-[120px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass rounded-3xl p-10 text-center relative z-10"
        >
          <div className="w-20 h-20 glass-dark rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
            <CheckCircle className="w-10 h-10 text-stitch-blue" />
          </div>
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">함께 해봐</h1>
          <p className="text-white mb-10 leading-relaxed font-bold">
            함께 꿈을 기록하고, 실시간으로 목표를 공유하며 하나씩 이뤄보세요.
          </p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-stitch-blue hover:bg-stitch-dark text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            Google 계정으로 시작하기
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen stitch-gradient pb-20 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-stitch-blue opacity-10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-stitch-purple opacity-10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="glass-dark sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stitch-blue rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">함께 해봐</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-white">{user.displayName}</span>
              <span className="text-xs text-blue-200">협업자</span>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-stitch-blue/30 shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
                <User className="w-5 h-5 text-blue-200" />
              </div>
            )}
            <button
              onClick={logout}
              className="p-2 text-blue-200 hover:text-stitch-pink hover:bg-white/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-10 relative z-10">
        {listError && (
          <div className="mb-6 p-4 glass border-red-500/30 rounded-2xl flex items-center gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{listError}</p>
          </div>
        )}
        {/* Add Item Form */}
        <form onSubmit={addItem} className="mb-12">
          <div className="relative group">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="다음엔 무엇을 해볼까요?"
              className="w-full glass text-white placeholder:text-white/60 focus:border-stitch-blue focus:ring-4 focus:ring-stitch-blue/20 rounded-2xl py-5 pl-6 pr-16 text-lg outline-none transition-all shadow-lg group-hover:shadow-blue-500/10 font-bold"
            />
            <button
              type="submit"
              disabled={!newItem.trim() || isAdding}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-stitch-blue hover:bg-stitch-dark disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/20 active:scale-90"
            >
              {isAdding ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="space-y-4">
          {listLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-stitch-blue" />
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`group glass rounded-2xl p-5 transition-all flex items-start gap-4 ${item.completed ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => toggleComplete(item)}
                    className={`mt-1 transition-colors ${item.completed ? 'text-green-300' : 'text-white/80 hover:text-stitch-blue'}`}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-7 h-7" />
                    ) : (
                      <Circle className="w-7 h-7" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {editingId === item.id ? (
                      <form onSubmit={updateItem} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="flex-1 glass text-white px-3 py-1 rounded-lg outline-none border border-stitch-blue/50 font-bold"
                          autoFocus
                        />
                      </form>
                    ) : (
                      <p className={`text-lg font-bold transition-all ${item.completed ? 'text-white/60 line-through' : 'text-white'}`}>
                        {item.text}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="text-xs text-white/80 flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        <span className="font-bold text-white">{item.createdByName}</span> 님이 추가함
                      </span>
                      {item.completed && item.completedByName && (
                        <span className="text-xs text-green-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="font-bold">{item.completedByName}</span> 님이 완료함
                        </span>
                      )}
                    </div>
                    
                    <CommentsSection itemId={item.id} user={user} />
                  </div>

                  {item.createdBy === user.uid && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {editingId === item.id ? (
                        <>
                          <button
                            onClick={() => updateItem()}
                            className="p-2 text-green-300 hover:text-green-200 hover:bg-white/10 rounded-lg transition-all"
                            title="Save"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-2 text-red-300 hover:text-red-200 hover:bg-white/10 rounded-lg transition-all"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(item)}
                            className="p-2 text-white hover:text-stitch-blue hover:bg-white/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-2 text-white hover:text-stitch-pink hover:bg-white/10 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-20 glass rounded-3xl border-2 border-dashed border-white/10">
                  <div className="w-16 h-16 glass-dark rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-blue-300" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">버킷리스트가 비어있습니다</h3>
                  <p className="text-blue-200">함께 하고 싶은 일을 추가해보세요!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Stats Floating Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass-dark text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-30">
          <div className="flex items-center gap-2">
            <span className="text-blue-300 text-[10px] uppercase tracking-widest font-black">ALL</span>
            <span className="text-lg font-black">{items.length}</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-[10px] uppercase tracking-widest font-black">DONE</span>
            <span className="text-lg font-black">{items.filter(i => i.completed).length}</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2">
            <span className="text-stitch-blue text-[10px] uppercase tracking-widest font-black">RATE</span>
            <span className="text-lg font-black">
              {Math.round((items.filter(i => i.completed).length / items.length) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BucketList />
    </ErrorBoundary>
  );
}
