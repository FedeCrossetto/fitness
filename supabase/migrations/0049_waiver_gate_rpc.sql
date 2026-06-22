-- ════════════════════════════════════════════════════════════════
-- 0049 — Gate de deslinde: RPC fiable + plantilla para coaches sin config
-- ════════════════════════════════════════════════════════════════

-- Plantilla por defecto para entrenadores que nunca guardaron en Settings
insert into public.waiver_configs (trainer_id, title, body, require_before_start)
select
  p.id,
  'Deslinde de Responsabilidad',
  $waiver$
DESLINDE DE RESPONSABILIDAD Y ASUNCIÓN DE RIESGOS

Yo, el firmante, habiendo contratado los servicios de entrenamiento personal, declaro haber sido informado/a sobre los riesgos inherentes a la práctica de actividad física y el ejercicio físico, incluyendo pero no limitado a: lesiones musculares, articulares, cardíacas u otras lesiones físicas que pudieran ocurrir durante el entrenamiento.

ASUNCIÓN DE RIESGOS
Asumo plena responsabilidad por cualquier lesión o daño que pudiera sufrir durante la práctica de las actividades físicas y programas de entrenamiento proporcionados por mi entrenador personal.

DECLARACIÓN DE APTITUD FÍSICA
Declaro que me encuentro en condiciones de salud aptas para realizar actividad física, que no padezco ninguna condición médica que me impida realizarla, y que he informado a mi entrenador sobre cualquier limitación o condición preexistente relevante.

LIBERACIÓN DE RESPONSABILIDAD
Por medio de la presente, libero a mi entrenador personal, sus empleados, representantes y afiliados de cualquier responsabilidad civil por lesiones, daños, accidentes o pérdidas que pudieran ocurrir durante o como consecuencia directa de las sesiones de entrenamiento.

Al firmar este documento manifiesto que he leído, entendido y acepto en su totalidad el contenido de este deslinde de responsabilidad.
$waiver$,
  true
from public.profiles p
where p.role in ('trainer', 'admin')
  and not exists (
    select 1 from public.waiver_configs wc where wc.trainer_id = p.id
  );

-- Estado del deslinde para el cliente autenticado (evita fallos silenciosos de RLS)
create or replace function public.get_client_waiver_gate()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trainer_id uuid;
  v_role text;
  v_cfg public.waiver_configs%rowtype;
  v_has_sig boolean;
begin
  if v_uid is null then
    return json_build_object('required', false);
  end if;

  select trainer_id, role
  into v_trainer_id, v_role
  from public.profiles
  where id = v_uid;

  if v_role in ('trainer', 'admin') or v_trainer_id is null then
    return json_build_object('required', false);
  end if;

  select * into v_cfg
  from public.waiver_configs
  where trainer_id = v_trainer_id;

  if not found
     or not v_cfg.require_before_start
     or coalesce(trim(v_cfg.body), '') = '' then
    return json_build_object('required', false);
  end if;

  select exists (
    select 1
    from public.waiver_signatures ws
    where ws.client_id = v_uid
      and ws.trainer_id = v_trainer_id
  ) into v_has_sig;

  if v_has_sig then
    return json_build_object('required', false);
  end if;

  return json_build_object(
    'required', true,
    'title', v_cfg.title,
    'body', v_cfg.body,
    'require_before_start', v_cfg.require_before_start
  );
end;
$$;

grant execute on function public.get_client_waiver_gate() to authenticated;
