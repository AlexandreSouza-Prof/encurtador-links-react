import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  setDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  getDoc, 
  updateDoc, 
  increment,
  addDoc,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { FiLink, FiCopy, FiTrash2, FiLogOut, FiExternalLink, FiEdit2, FiClock } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { MdQrCode } from 'react-icons/md';
import { QRCodeSVG } from 'qrcode.react';

const AuthScreen = ({ user }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error("Auth error:", err);
      let errorMessage = "Erro de autenticação: Verifique suas credenciais.";
      if (err.code === 'auth/email-already-in-use') errorMessage = "Este e-mail já está em uso.";
      else if (err.code === 'auth/weak-password') errorMessage = "A senha deve ter pelo menos 6 caracteres.";
      else if (err.code === 'auth/invalid-email') errorMessage = "E-mail inválido.";
      else if (err.code === 'auth/operation-not-allowed') errorMessage = "Autenticação por e-mail/senha não está ativada no Firebase Console.";
      else errorMessage = `Erro: ${err.message}`;
      
      setError(errorMessage);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Erro ao logar com Google.");
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel auth-box">
        <h2>{isLogin ? 'Acessar Encurtador' : 'Criar Conta'}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input 
            type="email" 
            className="input-field" 
            placeholder="Seu E-mail" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            className="input-field" 
            placeholder="Sua Senha" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          <button type="submit" className="btn">
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
        {error && <p className="text-error">{error}</p>}
        
        <div className="divider">OU</div>
        
        <button onClick={handleGoogleSignIn} className="btn btn-outline" style={{ width: '100%' }}>
          <FcGoogle size={20} /> Continuar com Google
        </button>

        <p className="mt-4" style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
          <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }}>
            {isLogin ? 'Crie agora' : 'Entre aqui'}
          </a>
        </p>
      </div>
    </div>
  );
};

const Dashboard = ({ user }) => {
  const [originalUrl, setOriginalUrl] = useState('');
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editingLink, setEditingLink] = useState(null);
  const [editOriginalUrl, setEditOriginalUrl] = useState('');
  const [editShortCode, setEditShortCode] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [qrLink, setQrLink] = useState(null);

  const openQrModal = (link) => setQrLink(link);
  const closeQrModal = () => setQrLink(null);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openHistoryModal = async (linkId) => {
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const q = query(collection(db, "links", linkId, "history"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryData(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar histórico: " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryModalOpen(false);
    setHistoryData([]);
  };

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "links"), 
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData = [];
      snapshot.forEach((doc) => {
        linksData.push({ id: doc.id, ...doc.data() });
      });
      // Sort client side by newest
      linksData.sort((a, b) => b.createdAt - a.createdAt);
      setLinks(linksData);
    });

    return () => unsubscribe();
  }, [user]);

  const generateShortCode = () => {
    return Math.random().toString(36).substring(2, 6) + Date.now().toString(36).slice(-3);
  };

  const handleShorten = async (e) => {
    e.preventDefault();
    if (!originalUrl.trim()) return;

    let urlToSave = originalUrl.trim();
    if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
      urlToSave = 'https://' + urlToSave;
    }

    setLoading(true);
    const shortCode = generateShortCode();
    
    try {
      await setDoc(doc(db, "links", shortCode), {
        originalUrl: urlToSave,
        shortCode: shortCode,
        clicks: 0,
        createdAt: Date.now(),
        userId: user.uid
      });
      setOriginalUrl('');
    } catch (err) {
      console.error(err);
      alert("Erro ao encurtar link: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (link) => {
    setEditingLink(link);
    setEditOriginalUrl(link.originalUrl);
    setEditShortCode(link.shortCode);
  };

  const closeEditModal = () => {
    setEditingLink(null);
    setEditOriginalUrl('');
    setEditShortCode('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editOriginalUrl.trim() || !editShortCode.trim()) return;

    let urlToSave = editOriginalUrl.trim();
    if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
      urlToSave = 'https://' + urlToSave;
    }
    
    let newCode = editShortCode.trim();
    
    const codeRegex = /^[a-zA-Z0-9-_]{3,15}$/;
    if (!codeRegex.test(newCode)) {
      alert("O código curto deve ter entre 3 e 15 caracteres (apenas letras, números, hífen e underline).");
      return;
    }

    setSavingEdit(true);

    try {
      if (newCode === editingLink.shortCode) {
        await updateDoc(doc(db, "links", editingLink.id), {
          originalUrl: urlToSave
        });
      } else {
        const newDocRef = doc(db, "links", newCode);
        const newDocSnap = await getDoc(newDocRef);
        
        if (newDocSnap.exists()) {
          alert("Este código curto já está em uso! Escolha outro.");
          setSavingEdit(false);
          return;
        }

        await setDoc(newDocRef, {
          originalUrl: urlToSave,
          shortCode: newCode,
          clicks: editingLink.clicks,
          createdAt: editingLink.createdAt,
          userId: user.uid
        });

        await deleteDoc(doc(db, "links", editingLink.id));
      }
      
      closeEditModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao editar link: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm('Tem certeza que deseja excluir este link?')) {
      try {
        await deleteDoc(doc(db, "links", id));
      } catch (err) {
        alert("Erro ao excluir: " + err.message);
      }
    }
  };

  const handleCopy = (code) => {
    const shortUrl = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(shortUrl);
    alert('Link copiado!');
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="app-container">
      <header className="header glass-panel">
        <h1>Encurta link Senai</h1>
        <div className="user-info">
          <span className="user-email">{user.email}</span>
          <button onClick={() => signOut(auth)} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
            <FiLogOut /> Sair
          </button>
        </div>
      </header>

      <section className="shortener-section glass-panel">
        <h2>Encurte seus links facilmente</h2>
        <form onSubmit={handleShorten} className="shortener-form">
          <input 
            type="text" 
            className="input-field" 
            placeholder="Cole sua URL longa (ex: https://site.com/muito-longa)" 
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn" disabled={loading}>
            <FiLink /> {loading ? 'Encurtando...' : 'Encurtar'}
          </button>
        </form>
      </section>

      <section className="links-section glass-panel">
        <h3>Seus Links Gerados</h3>
        <div className="links-table-container">
          <table className="links-table">
            <thead>
              <tr>
                <th>URL Original</th>
                <th>Link Curto</th>
                <th>Cliques</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {links.length === 0 ? (
                <tr><td colSpan="5" className="text-center">Nenhum link criado ainda.</td></tr>
              ) : (
                links.map(link => (
                  <tr key={link.id}>
                    <td className="url-cell" title={link.originalUrl}>
                      <a href={link.originalUrl} target="_blank" rel="noreferrer" style={{color: 'inherit'}}>{link.originalUrl}</a>
                    </td>
                    <td className="short-link-cell">
                      /r/{link.shortCode}
                    </td>
                    <td>
                      <button 
                        onClick={() => openHistoryModal(link.id)} 
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                        title="Ver Histórico"
                      >
                        {link.clicks}
                      </button>
                    </td>
                    <td>{new Date(link.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="actions-cell">
                      <button onClick={() => openQrModal(link)} className="btn btn-outline" title="QR Code">
                        <MdQrCode />
                      </button>
                      <button onClick={() => openEditModal(link)} className="btn btn-outline" title="Editar">
                        <FiEdit2 />
                      </button>
                      <button onClick={() => handleCopy(link.shortCode)} className="btn btn-outline" title="Copiar">
                        <FiCopy />
                      </button>
                      <button onClick={() => handleDelete(link.id)} className="btn btn-danger" title="Excluir">
                        <FiTrash2 />
                      </button>
                      <a href={`/r/${link.shortCode}`} target="_blank" rel="noreferrer" className="btn btn-outline" title="Testar">
                        <FiExternalLink />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingLink && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Link</h2>
              <button className="btn-close" onClick={closeEditModal}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body">
              <div className="input-group">
                <label>URL Original</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editOriginalUrl}
                  onChange={(e) => setEditOriginalUrl(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Código Curto</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  <span style={{color: '#94a3b8'}}>{window.location.origin}/r/</span>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editShortCode}
                    onChange={(e) => setEditShortCode(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={closeEditModal}>Cancelar</button>
                <button type="submit" className="btn" disabled={savingEdit}>
                  {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de QR Code */}
      {qrLink && (
        <div className="modal-overlay" onClick={closeQrModal}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2>QR Code</h2>
              <button className="btn-close" onClick={closeQrModal}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '2rem', background: '#fff', borderRadius: '8px', margin: '1rem', display: 'flex', justifyContent: 'center' }}>
              <QRCodeSVG 
                value={`${window.location.origin}/r/${qrLink.shortCode}`} 
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#0f172a"}
                level={"H"}
              />
            </div>
            <p style={{marginBottom: '1rem'}}>/r/{qrLink.shortCode}</p>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn" onClick={closeQrModal}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {historyModalOpen && (
        <div className="modal-overlay" onClick={closeHistoryModal}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Histórico de Cliques</h2>
              <button className="btn-close" onClick={closeHistoryModal}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loadingHistory ? (
                <p className="text-center" style={{padding: '2rem'}}>Carregando metadados...</p>
              ) : historyData.length === 0 ? (
                <p className="text-center" style={{padding: '2rem'}}>Nenhum metadado registrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
                  {historyData.map(item => (
                    <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FiClock /> {new Date(item.timestamp).toLocaleString('pt-BR')}</strong>
                        <span style={{ fontSize: '0.75rem', background: '#38bdf8', color: '#0f172a', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{item.platform}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <p><strong>Navegador:</strong> <span style={{ color: '#94a3b8' }}>{item.userAgent}</span></p>
                        <p><strong>Origem:</strong> <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{item.referrer === 'Direto' ? 'Direto / Desconhecido' : item.referrer}</span></p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                          <p><strong>Idioma:</strong> <span style={{ color: '#94a3b8' }}>{item.language || 'N/A'}</span></p>
                          <p><strong>Resolução:</strong> <span style={{ color: '#94a3b8' }}>{item.screen || 'N/A'}</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={closeHistoryModal}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RedirectHandler = () => {
  const { code } = useParams();
  const [error, setError] = useState('');
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const handleRedirect = async () => {
      try {
        const linkRef = doc(db, "links", code);
        const linkSnap = await getDoc(linkRef);
        
        if (linkSnap.exists()) {
          const data = linkSnap.data();
          try {
            // Salva o histórico de metadados
            await addDoc(collection(db, "links", code, "history"), {
              timestamp: Date.now(),
              userAgent: navigator.userAgent || 'Desconhecido',
              referrer: document.referrer || 'Direto',
              language: navigator.language || 'Desconhecido',
              platform: navigator.platform || 'Desconhecido',
              screen: `${window.screen.width || 0}x${window.screen.height || 0}`
            });

            // Incrementa o clique principal
            await updateDoc(linkRef, {
              clicks: increment(1)
            });
          } catch (err) {
            console.error("Aviso: Falha ao registrar clique.", err);
          } finally {
            window.location.replace(data.originalUrl);
          }
        } else {
          setError("Este link não foi encontrado ou não existe mais.");
        }
      } catch (err) {
        setError("Erro ao acessar o link: " + err.message);
      }
    };

    handleRedirect();
  }, [code]);

  return (
    <div className="auth-container text-center">
      <div className="glass-panel" style={{padding: '3rem'}}>
        {error ? <p className="text-error" style={{fontSize: '1.2rem'}}>{error}</p> : <p style={{fontSize: '1.2rem'}}>Redirecionando...</p>}
      </div>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="auth-container"><p>Carregando sistema...</p></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/login" element={<AuthScreen user={user} />} />
        <Route path="/r/:code" element={<RedirectHandler />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
