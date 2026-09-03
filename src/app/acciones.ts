'use server';

import { revalidatePath } from 'next/cache';
import { lanzarBarrido, type ResultadoLanzamiento } from '@/lib/lanzador';

export async function lanzarRadar(): Promise<ResultadoLanzamiento> {
  const r = await lanzarBarrido();
  revalidatePath('/');
  return r;
}
