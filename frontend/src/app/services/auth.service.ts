import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: 'administrador' | 'operador' | string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  csrf_token: string;
}

interface MeResponse {
  success: boolean;
  authenticated: boolean;
  user: AuthUser;
  csrf_token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly userState = signal<AuthUser | null>(null);
  readonly currentUser = this.userState.asReadonly();

  private csrfToken: string | null = null;

  getCsrfToken(): string {
    return this.csrfToken ?? '';
  }

  /**
   * Recupera la sesión existente al cargar la aplicación.
   * Si no hay sesión, devuelve null sin tratarlo como un error visual.
   */
  checkSession(): Observable<AuthUser | null> {
    return this.http.get<MeResponse>('/api/auth/me', {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.userState.set(response.user);
        this.csrfToken = response.csrf_token;
      }),
      map(response => response.user),
      catchError(() => {
        this.userState.set(null);
        this.csrfToken = null;
        return of(null);
      })
    );
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      '/api/auth/login',
      { email, password },
      { withCredentials: true }
    ).pipe(
      tap(response => {
        this.userState.set(response.user);
        this.csrfToken = response.csrf_token;
      })
    );
  }

  logout(): Observable<{ success: boolean; message: string }> {
    const headers = new HttpHeaders({
      'X-CSRF-Token': this.csrfToken ?? ''
    });

    return this.http.post<{ success: boolean; message: string }>(
      '/api/auth/logout',
      {},
      {
        headers,
        withCredentials: true
      }
    ).pipe(
      tap(() => {
        this.userState.set(null);
        this.csrfToken = null;
      })
    );
  }
}
