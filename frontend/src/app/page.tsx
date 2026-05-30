"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPlan, listPlans, login, register, type Plan } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("client@demo.tn");
  const [password, setPassword] = useState("demo1234");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!localStorage.getItem("bp_token"));
  }, []);

  const handleAuth = async (mode: "login" | "register") => {
    setError("");
    try {
      if (mode === "register") await register(email, password);
      const { access_token } = await login(email, password);
      localStorage.setItem("bp_token", access_token);
      setLoggedIn(true);
      const p = await listPlans();
      setPlans(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const loadPlans = async () => {
    try {
      setPlans(await listPlans());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  const newPlan = async () => {
    const p = await createPlan("Business Plan " + new Date().toLocaleDateString("fr-TN"));
    router.push(`/plans/${p.id}`);
  };

  useEffect(() => {
    if (loggedIn) loadPlans();
  }, [loggedIn]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
      <h1>Business Plan Tunisie</h1>
      <p style={{ color: "#555" }}>
        Workflow Client / Expert — conformité Liasse Unique TIA — projection 7 ans
      </p>

      {!loggedIn ? (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, marginTop: 24 }}>
          <h2>Connexion</h2>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8, padding: 8 }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 12, padding: 8 }}
          />
          <button onClick={() => handleAuth("login")} style={{ marginRight: 8, padding: "8px 16px" }}>
            Connexion
          </button>
          <button onClick={() => handleAuth("register")} style={{ padding: "8px 16px" }}>
            Créer compte
          </button>
          {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 24 }}>
            <button onClick={newPlan} style={{ padding: "10px 20px", marginRight: 12 }}>
              Nouveau business plan
            </button>
            <button onClick={loadPlans} style={{ padding: "10px 20px" }}>
              Actualiser
            </button>
          </div>
          <ul style={{ marginTop: 24, listStyle: "none", padding: 0 }}>
            {plans.map((p) => (
              <li
                key={p.id}
                style={{
                  background: "#fff",
                  padding: 16,
                  marginBottom: 8,
                  borderRadius: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <Link href={`/plans/${p.id}`}>
                    <strong>{p.title}</strong>
                  </Link>
                  <span style={{ marginLeft: 12, fontSize: 13, color: "#666" }}>
                    [{p.status}]
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
