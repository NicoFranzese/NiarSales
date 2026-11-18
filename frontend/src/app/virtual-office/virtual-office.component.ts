import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Office3DComponent } from './office-3d/office-3d.component';
import { timer, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface BudgetStatus {
  month: string; monthly_limit_usd: number; spent_usd: number; reserved_usd: number;
  available_usd: number; input_tokens: number; output_tokens: number; total_tokens: number;
  requests: number; completed_requests: number; failed_requests: number; enabled: boolean; currency: string;
}

interface OfficeAgent {
  slug: string; nombre: string; rol: string; sala: string; descripcion: string;
  habilitado: number | string; avatar: string; orden: number;
}

@Component({
  selector: 'app-virtual-office',
  standalone: true,
  imports: [CommonModule, FormsModule, Office3DComponent],
  templateUrl: './virtual-office.component.html',
  styleUrl: './virtual-office.component.scss'
})
export class VirtualOfficeComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  readonly agents = signal<OfficeAgent[]>([]);
  readonly executions = signal<any[]>([]);
  readonly events = signal<any[]>([]);
  readonly activeExecution = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly lastUpdate = signal('');
  readonly missionRubro = signal('Pizzerías');
  readonly missionLocalidad = signal('Avellaneda');
  readonly missionCantidad = signal(5);
  readonly missionSending = signal(false);
  readonly missionMessage = signal('');
  readonly missionError = signal('');
  readonly adaSending = signal(false);
  readonly adaMessage = signal('');
  readonly adaError = signal('');
  readonly adaCantidad = signal(3);
  readonly adaCandidates = signal<any[]>([]);
  readonly adaSelectedIds = signal<number[]>([]);
  readonly adaSearch = signal('');
  readonly adaCandidatesLoading = signal(false);
  readonly adaView = signal<'pending' | 'analyzed'>('pending');
  readonly adaCounts = signal({ total: 0, pending: 0, analyzed: 0 });


  readonly budget = signal<BudgetStatus | null>(null);
  readonly budgetError = signal('');
  readonly selectedAgent = signal<any | null>(null);
  readonly agentTasks = signal<any[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly selectedExecution = signal<any | null>(null);
  readonly executionEvents = signal<any[]>([]);
  readonly executionResults = signal<any[]>([]);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');


  constructor() {
    timer(0, 5000).pipe(
      switchMap(() => this.http.get<any>('/api/agent/office', { withCredentials: true }).pipe(
        catchError((e) => {
          this.error.set(e.error?.message || 'No se pudo actualizar la oficina.');
          this.loading.set(false);
          return of(null);
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (!response?.data) return;
      const data = response.data;
      this.agents.set(data.agents || []);
      this.executions.set(data.executions || []);
      this.events.set(data.events || []);
      this.activeExecution.set(data.active_execution || null);
      this.error.set('');
      this.loading.set(false);
      this.lastUpdate.set(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      this.loadBudget();
    });
    this.loadAdaCandidates();
  }

  agentIsWorking(slug: string): boolean {
    if (!this.isEnabled(this.agents().find(a => a.slug === slug)?.habilitado)) return false;
    // La misión se ejecuta en una única petición HTTP. Reflejamos inmediatamente
    // el estado local mientras esa petición está pendiente, sin esperar al polling.
    if (this.missionSending() && (slug === 'coordinador' || slug === 'investigador')) return true;
    if (this.adaSending() && slug === 'analista') return true;
    const task = this.activeExecution();
    if (!task) return false;
    if (slug === 'investigador') return true;
    if (slug === 'coordinador') return task.parametros?.coordinated_by_nora === true;
    if (slug === 'ventas') return task.parametros?.agente === 'ventas';
    if (slug === 'seguimiento') return task.parametros?.agente === 'seguimiento';
    return false;
  }

  workingSlugs(): string[] {
    return this.agents().filter(a => this.agentIsWorking(a.slug)).map(a => a.slug);
  }

  openAgentHistoryBySlug(slug: string): void {
    const agent = this.agents().find(a => a.slug === slug);
    if (agent) this.openAgentHistory(agent);
  }

  isEnabled(value: unknown): boolean { return value === 1 || value === '1' || value === true; }
  stateLabel(slug: string): string {
    if (!this.isEnabled(this.agents().find(a => a.slug === slug)?.habilitado)) return 'En preparación';
    return this.agentIsWorking(slug) ? 'Trabajando' : 'Disponible';
  }
  stateClass(slug: string): string {
    if (!this.isEnabled(this.agents().find(a => a.slug === slug)?.habilitado)) return 'planned';
    return this.agentIsWorking(slug) ? 'working' : 'ready';
  }
  executionLabel(state: string): string {
    const labels: Record<string, string> = { pendiente: 'Pendiente', ejecutando: 'En ejecución', completada: 'Completada', fallida: 'Fallida', cancelada: 'Cancelada' };
    return labels[state] || state || 'Sin estado';
  }
  eventTime(value: string): string {
    if (!value) return '';
    const date = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  }

  openAgentHistory(agent: OfficeAgent): void {
    this.selectedAgent.set(agent);
    this.agentTasks.set([]);
    this.historyError.set('');
    this.historyLoading.set(true);
    this.selectedExecution.set(null);
    this.http.get<any>(`/api/agent/agents/${encodeURIComponent(agent.slug)}/history`, { withCredentials: true }).subscribe({
      next: (response) => {
        this.agentTasks.set(response?.data?.tasks || []);
        this.historyLoading.set(false);
      },
      error: (error) => {
        this.historyError.set(error?.error?.message || 'No se pudo cargar el historial del agente.');
        this.historyLoading.set(false);
      }
    });
  }

  openExecutionDetail(executionId: number): void {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.selectedExecution.set({ id: executionId, objetivo: 'Cargando detalle de tarea…', estado: 'pendiente' });
    this.executionEvents.set([]);
    this.executionResults.set([]);
    this.http.get<any>(`/api/agent/executions/${executionId}`, { withCredentials: true }).subscribe({
      next: (response) => {
        const data = response?.data || {};
        this.selectedExecution.set(data.execution || null);
        this.executionEvents.set(data.events || []);
        this.executionResults.set(data.results || []);
        this.detailLoading.set(false);
      },
      error: (error) => {
        this.detailError.set(error?.error?.message || 'No se pudo cargar el detalle de la tarea.');
        this.detailLoading.set(false);
      }
    });
  }

  closeAgentHistory(): void {
    this.selectedAgent.set(null);
    this.selectedExecution.set(null);
    this.agentTasks.set([]);
    this.executionEvents.set([]);
    this.executionResults.set([]);
  }

  closeExecutionDetail(): void {
    this.selectedExecution.set(null);
    this.executionEvents.set([]);
    this.executionResults.set([]);
    this.detailError.set('');
  }

  listValue(value: unknown): string {
    return Array.isArray(value) ? value.map(item => String(item)).join(' · ') : (value == null ? 'No informado' : String(value));
  }

  loadBudget(): void {
    this.http.get<any>('/api/budget/status', { withCredentials: true }).subscribe({
      next: (response) => { this.budget.set(response?.data || null); this.budgetError.set(''); },
      error: (error) => { this.budgetError.set(error?.error?.message || 'No se pudo consultar el consumo de IA.'); }
    });
  }

  money(value: number | undefined): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(Number(value || 0));
  }

  budgetPercent(b: BudgetStatus): number {
    if (!b.monthly_limit_usd) return 0;
    return Math.max(0, Math.min(100, 100 * (b.spent_usd + b.reserved_usd) / b.monthly_limit_usd));
  }

  number(value: number | undefined): string {
    return new Intl.NumberFormat('es-AR').format(Number(value || 0));
  }

  loadAdaCandidates(): void {
    this.adaCandidatesLoading.set(true);
    this.adaError.set('');
    const q = this.adaSearch().trim();
    const params = new URLSearchParams({ view: this.adaView() });
    if (q) params.set('q', q);
    this.http.get<any>(`/api/agent/ada/candidates?${params.toString()}`, { withCredentials: true }).subscribe({
      next: (response) => {
        const rows = response?.data?.candidates || [];
        this.adaCandidates.set(rows);
        this.adaCounts.set(response?.data?.counts || { total: 0, pending: 0, analyzed: 0 });
        if (this.adaView() === 'analyzed') this.adaSelectedIds.set([]);
        this.adaCandidatesLoading.set(false);
      },
      error: (error) => {
        this.adaCandidatesLoading.set(false);
        this.adaError.set(error?.error?.message || 'No se pudieron cargar los prospectos de Ada.');
      }
    });
  }

  setAdaView(view: 'pending' | 'analyzed'): void {
    if (this.adaView() === view) return;
    this.adaView.set(view);
    this.adaSelectedIds.set([]);
    this.loadAdaCandidates();
  }

  toggleAdaCandidate(id: number, checked: boolean): void {
    const current = this.adaSelectedIds();
    if (checked) {
      if (current.length >= 5) { this.adaError.set('Podés seleccionar hasta 5 prospectos por tarea.'); return; }
      this.adaSelectedIds.set([...current, id]);
    } else {
      this.adaSelectedIds.set(current.filter(value => value !== id));
    }
    this.adaError.set('');
  }

  isAdaSelected(id: number): boolean {
    return this.adaSelectedIds().includes(Number(id));
  }

  selectVisibleAdaCandidates(): void {
    if (this.adaView() !== 'pending') return;
    const ids = this.adaCandidates().slice(0, 5).map(row => Number(row.id));
    this.adaSelectedIds.set(ids);
    this.adaError.set('');
  }

  clearAdaSelection(): void { this.adaSelectedIds.set([]); }

  analyzeWithAda(): void {
    if (this.adaSending() || this.missionSending() || this.activeExecution()) { this.adaError.set('Esperá a que termine la tarea que está en curso.'); return; }
    this.adaSending.set(true); this.adaError.set(''); this.adaMessage.set('Ada está evaluando los prospectos seleccionados. No está realizando nuevas búsquedas.');
    this.http.post<any>('/api/agent/ada/analyze', { prospecto_ids: this.adaSelectedIds() }, { withCredentials: true, headers: new HttpHeaders({ 'X-CSRF-Token': this.auth.getCsrfToken() }) }).subscribe({
      next: (response) => { this.adaSending.set(false); this.adaMessage.set(response?.message || 'Ada terminó su análisis.'); this.adaSelectedIds.set([]); this.adaView.set('pending'); this.loadAdaCandidates(); this.refresh(); },
      error: (error) => { this.adaSending.set(false); this.adaMessage.set(''); this.adaError.set(error?.error?.message || 'No se pudo ejecutar el análisis de Ada.'); this.loadAdaCandidates(); this.refresh(); }
    });
  }

  delegateMission(): void {
    const rubro = this.missionRubro().trim();
    const localidad = this.missionLocalidad().trim();
    const cantidad = Math.max(1, Math.min(10, Number(this.missionCantidad()) || 5));
    if (!rubro || !localidad) { this.missionError.set('Completá el rubro y la localidad.'); return; }
    if (this.activeExecution()) { this.missionError.set('Ya hay una investigación en curso. Esperá a que termine antes de asignar otra.'); return; }
    this.missionSending.set(true); this.missionError.set(''); this.missionMessage.set('Nora está asignando la investigación a Ivo...');
    this.http.post<any>('/api/agent/coordinate', { rubro, localidad, cantidad }, {
      withCredentials: true, headers: new HttpHeaders({ 'X-CSRF-Token': this.auth.getCsrfToken() })
    }).subscribe({
      next: (response) => {
        this.missionSending.set(false);
        this.missionMessage.set(response?.message || 'Ivo completó la tarea asignada por Nora.');
        this.refresh();
      },
      error: (error) => {
        this.missionSending.set(false);
        this.missionMessage.set('');
        this.missionError.set(error?.error?.message || 'No se pudo ejecutar la misión coordinada.');
        this.refresh();
      }
    });
  }

  refresh(): void {
    this.loading.set(true);
    this.http.get<any>('/api/agent/office', { withCredentials: true }).subscribe({
      next: r => { const d = r.data || {}; this.agents.set(d.agents || []); this.executions.set(d.executions || []); this.events.set(d.events || []); this.activeExecution.set(d.active_execution || null); this.error.set(''); this.loading.set(false); this.loadBudget(); },
      error: e => { this.error.set(e.error?.message || 'No se pudo actualizar la oficina.'); this.loading.set(false); }
    });
  }
}
