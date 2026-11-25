"use client";

import {
  api,
  errorMessage,
  errorStatus,
  type AssignableMemberRole,
  type MemberRole,
  type TenantMember,
} from "@vendelier/api-client";
import { actionClass, fieldClass, Field, formatDate, Notice, panelClass, quietClass } from "@vendelier/ui";
import { Trash2, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

const roleLabels: Record<MemberRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  catalog: "Catálogo",
  orders: "Pedidos",
  analyst: "Analista",
};

const assignableRoles: AssignableMemberRole[] = ["admin", "catalog", "orders", "analyst"];

export function TeamPanel() {
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableMemberRole>("catalog");

  useEffect(() => {
    const controller = new AbortController();
    api.team(controller.signal).then((data) => {
      setMembers(data);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      if (errorStatus(cause) === 403) {
        setForbidden(true);
      } else {
        setError(errorMessage(cause, "No pudimos consultar el equipo."));
      }
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api.inviteMember(email.trim(), role);
      setMembers((current) => [...current, created]);
      setEmail("");
      setNotice(`Colaborador ${created.email} agregado con rol ${roleLabels[created.role]}.`);
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos invitar al colaborador.", {
        403: "Tu rol no permite asignar este permiso.",
        409: "Ese usuario ya forma parte del equipo.",
      }));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: TenantMember, nextRole: AssignableMemberRole) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.updateMemberRole(member.userId, nextRole);
      setMembers((current) => current.map((m) => (m.userId === updated.userId ? updated : m)));
      setNotice(`Rol de ${updated.email} actualizado a ${roleLabels[updated.role]}.`);
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos actualizar el rol.", {
        403: "Solo el propietario puede cambiar roles de colaboradores.",
      }));
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: TenantMember) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.removeMember(member.userId);
      setMembers((current) => current.filter((m) => m.userId !== member.userId));
      setNotice(`Se revocó el acceso de ${member.email}.`);
    } catch (cause) {
      setError(errorMessage(cause, "No pudimos quitar al colaborador.", {
        403: "Tu rol no permite quitar colaboradores.",
      }));
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <section className={panelClass}>
        <h2 className="text-lg font-semibold tracking-tight">Equipo y permisos</h2>
        <p className="mt-2 text-sm text-muted">
          Tu rol actual no tiene permisos para administrar colaboradores de la tienda.
        </p>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
      <section className={panelClass} aria-labelledby="team-list-title">
        <h2 id="team-list-title" className="text-lg font-semibold tracking-tight">Equipo ({members.length})</h2>
        {error && <div className="mt-3"><Notice kind="error">{error}</Notice></div>}
        {notice && <div className="mt-3"><Notice kind="success">{notice}</Notice></div>}
        {loading ? (
          <p className="mt-4 text-sm text-muted">Cargando colaboradores…</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold wrap-anywhere">{member.email}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {roleLabels[member.role]} · Desde {formatDate(member.createdAt)}
                  </p>
                </div>
                {member.role !== "owner" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Rol de ${member.email}`}
                      className={`${fieldClass} w-auto py-1.5 text-xs`}
                      disabled={busy}
                      value={member.role}
                      onChange={(event) => changeRole(member, event.target.value as AssignableMemberRole)}
                    >
                      {assignableRoles.map((r) => (
                        <option key={r} value={r}>{roleLabels[r]}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={`${quietClass} text-danger`}
                      aria-label={`Quitar a ${member.email}`}
                      disabled={busy}
                      onClick={() => remove(member)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={invite} className={`${panelClass} grid gap-4`}>
        <h3 className="flex items-center gap-2 border-b border-border pb-3 text-lg font-semibold tracking-tight">
          <UserPlus size={18} aria-hidden="true" /> Invitar colaborador
        </h3>
        <Field label="Correo electrónico">
          <input
            type="email"
            required
            maxLength={254}
            className={fieldClass}
            placeholder="colaborador@tienda.mx"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Rol en la tienda">
          <select
            className={fieldClass}
            value={role}
            onChange={(event) => setRole(event.target.value as AssignableMemberRole)}
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </Field>
        <button type="submit" className={actionClass} disabled={busy}>
          {busy ? "Invitando…" : "Agregar al equipo"}
        </button>
      </form>
    </div>
  );
}
