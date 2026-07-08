/**
 * Términos y Condiciones — contenido legal bilingüe (ES/EN).
 *
 * R3SET es una plataforma de software que entrenadores personales usan para
 * administrar a sus clientes (planes, nutrición, mensajería, pagos). Cada
 * entrenador puede tener su propia app de marca blanca (ver `trainer_branding`),
 * pero el operador del servicio y responsable de estos Términos es siempre R3SET.
 *
 * Hosting: el documento se sirve como página estática en el dominio público del
 * coach (fuera de este repo — ver README de deploy), no en la webapp. Tanto la
 * web (sidebar, /unirse, ClientDetail) como la app mobile enlazan a APP_TERMS_URL.
 */

/** URL pública donde vive la página de Términos y Condiciones. Único lugar a
 * tocar si el documento se muda de dominio. */
export const APP_TERMS_URL = 'https://www.alegerezcoach.com/app-terms';

/** Versión del documento — debe coincidir con el literal escrito en el trigger
 * `handle_new_user()` (supabase/migrations/20260707050000_terms_acceptance.sql)
 * y con `profiles.terms_version`. Si el texto legal cambia materialmente, subir
 * este valor y actualizar la migración correspondiente. */
export const TERMS_VERSION = '2026-07-07';

export interface LegalSection {
  title: string;
  body: string[];
}

export interface LegalDocument {
  documentTitle: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
}

const es: LegalDocument = {
  documentTitle: 'Términos y Condiciones',
  effectiveDate: 'Última actualización: 7 de julio de 2026',
  intro: [
    'Estos Términos y Condiciones ("Términos") regulan el uso de R3SET (el "Servicio"), una plataforma que permite a entrenadores personales y coaches de fitness ("Entrenadores") administrar clientes, planes de entrenamiento, seguimiento nutricional, mensajería y pagos, y que permite a sus clientes ("Clientes" o "Usuarios") acceder a esos servicios a través de nuestra aplicación web y aplicación móvil.',
    'Al crear una cuenta, acceder o usar el Servicio, aceptás quedar obligado por estos Términos y por nuestra Política de Privacidad. Si no estás de acuerdo, no debés usar el Servicio.',
    'Algunos Entrenadores ofrecen el Servicio bajo su propia marca ("app de marca blanca"). Sin importar el nombre o el logo que veas, el Servicio es operado por R3SET, y estos Términos aplican de la misma forma.',
  ],
  sections: [
    {
      title: '1. Elegibilidad y registro de cuenta',
      body: [
        'Para usar el Servicio debés tener al menos 18 años, o la mayoría de edad legal en tu jurisdicción, y contar con capacidad legal para aceptar estos Términos. Si sos menor de edad, necesitás el consentimiento de un padre, madre o tutor legal, quien acepta estos Términos en tu representación.',
        'Sos responsable de la exactitud de la información que proporcionás al registrarte (nombre, email, teléfono, datos de salud que compartís voluntariamente) y de mantenerla actualizada. Sos responsable de toda actividad que ocurra en tu cuenta y de mantener la confidencialidad de tus credenciales de acceso.',
        'Nos reservamos el derecho de suspender o cancelar cuentas que contengan información falsa, que hayan sido creadas con fines fraudulentos, o que violen estos Términos.',
      ],
    },
    {
      title: '2. Descripción del Servicio',
      body: [
        'R3SET provee herramientas de software para que los Entrenadores diseñen y asignen rutinas de entrenamiento, hagan seguimiento nutricional, se comuniquen con sus Clientes, registren mediciones y progreso, y administren pagos y suscripciones.',
        'R3SET no es un Entrenador ni un profesional de la salud. La relación de coaching, el diseño de los planes y las recomendaciones son responsabilidad exclusiva del Entrenador con el que trabajás. R3SET únicamente provee la infraestructura tecnológica.',
        'Podemos modificar, agregar o discontinuar funciones del Servicio en cualquier momento, con o sin previo aviso, para mejorar la plataforma o por razones operativas, legales o de seguridad.',
      ],
    },
    {
      title: '3. Suscripciones, precios y facturación',
      body: [
        'Algunos planes ofrecidos por tu Entrenador requieren el pago de una suscripción recurrente o de un pago único, procesados a través de Mercado Pago u otros procesadores de pago habilitados. Al suscribirte, autorizás el cobro periódico del monto correspondiente según la frecuencia elegida (mensual, trimestral, semestral o anual).',
        'Los precios son establecidos por cada Entrenador y pueden variar. Si el precio de tu plan cambia, se te va a notificar con anticipación razonable antes de que el nuevo monto se aplique a tu próximo cobro.',
        'Las suscripciones se renuevan automáticamente al final de cada período de facturación, salvo que las canceles antes de la fecha de renovación. Podés cancelar en cualquier momento desde la app o contactando a tu Entrenador; la cancelación tiene efecto al final del período ya pagado, sin reembolsos proporcionales salvo que la ley aplicable disponga lo contrario.',
        'Sos responsable de mantener un método de pago válido y de los cargos que resulten de información de pago desactualizada.',
      ],
    },
    {
      title: '4. Descargo de responsabilidad sobre salud y asunción de riesgo',
      body: [
        'El Servicio incluye contenido relacionado con entrenamiento físico y nutrición. Este contenido es de carácter general e informativo, y no constituye asesoramiento médico, diagnóstico ni tratamiento. Nada de lo que aparece en el Servicio reemplaza la consulta con un médico u otro profesional de la salud calificado.',
        'Antes de comenzar cualquier programa de entrenamiento o cambio en tu alimentación, te recomendamos consultar con un profesional de la salud, especialmente si tenés una condición médica preexistente, estás embarazada, o tomás medicación.',
        'El ejercicio físico conlleva riesgos inherentes, incluyendo lesiones. Al usar el Servicio, reconocés y aceptás voluntariamente esos riesgos, y usás las rutinas, recomendaciones y contenido bajo tu propia responsabilidad. Si tu Entrenador te solicita firmar un deslinde de responsabilidad específico, ese documento aplica adicionalmente a estos Términos.',
        'R3SET, y en la medida permitida por la ley, tu Entrenador, no serán responsables por lesiones, daños o perjuicios derivados del uso del contenido de entrenamiento o nutricional del Servicio.',
      ],
    },
    {
      title: '5. Conducta del usuario',
      body: [
        'Te comprometés a usar el Servicio de forma lícita y respetuosa. En particular, aceptás no: (a) acosar, amenazar o discriminar a otros usuarios o entrenadores; (b) publicar contenido difamatorio, obsceno o que infrinja derechos de terceros; (c) intentar acceder sin autorización a cuentas, sistemas o datos de otros usuarios; (d) usar el Servicio para fines distintos al coaching fitness/nutricional legítimo; (e) realizar ingeniería inversa, copiar o distribuir el software del Servicio sin autorización.',
        'Nos reservamos el derecho de suspender o cancelar cuentas que incumplan esta sección, sin necesidad de previo aviso en casos graves.',
      ],
    },
    {
      title: '6. Contenido del usuario',
      body: [
        'El Servicio te permite cargar contenido como fotos de progreso, mensajes, mediciones y comentarios ("Contenido del Usuario"). Conservás la titularidad de tu Contenido del Usuario.',
        'Al cargar Contenido del Usuario, le otorgás a R3SET y a tu Entrenador una licencia no exclusiva, mundial y libre de regalías para almacenar, procesar y mostrar ese contenido exclusivamente con el fin de prestarte el Servicio (por ejemplo, para que tu Entrenador revise tu progreso).',
        'Sos responsable de contar con los derechos necesarios sobre el contenido que subís y de que no infrinja derechos de terceros.',
      ],
    },
    {
      title: '7. Propiedad intelectual',
      body: [
        'El Servicio, su software, diseño, marcas y contenido desarrollado por R3SET (excluyendo el Contenido del Usuario y el contenido específico que cada Entrenador crea para sus Clientes) son propiedad de R3SET o de sus licenciantes, y están protegidos por leyes de propiedad intelectual.',
        'Se te otorga una licencia limitada, personal, no exclusiva e intransferible para usar el Servicio de acuerdo con estos Términos. No se te transfiere ningún otro derecho.',
      ],
    },
    {
      title: '8. Servicios de terceros',
      body: [
        'El Servicio se integra con proveedores externos como Mercado Pago (procesamiento de pagos), Apple Health / Google Health Connect (sincronización de datos de salud y actividad, si lo autorizás), y otros servicios de calendario o comunicación. El uso de esos servicios de terceros está sujeto a sus propios términos y políticas de privacidad, que te recomendamos revisar.',
        'R3SET no se responsabiliza por el funcionamiento, disponibilidad o prácticas de privacidad de servicios de terceros que no controla directamente.',
      ],
    },
    {
      title: '9. Privacidad',
      body: [
        'El tratamiento de tus datos personales se rige por nuestra Política de Privacidad, que forma parte integral de estos Términos. Ahí detallamos qué datos recolectamos (incluyendo datos de salud que compartís voluntariamente, como peso, mediciones o actividad física), para qué los usamos y con quién los compartimos (por ejemplo, con tu Entrenador, ya que es indispensable para prestar el Servicio).',
      ],
    },
    {
      title: '10. Terminación',
      body: [
        'Podés dejar de usar el Servicio y solicitar la eliminación de tu cuenta en cualquier momento, contactando a tu Entrenador o a través de la configuración de la app.',
        'Podemos suspender o cancelar tu acceso al Servicio si incumplís estos Términos, si tu Entrenador da de baja tu cuenta, por falta de pago, o por requerimiento legal. En caso de cancelación, ciertas disposiciones de estos Términos (como las de propiedad intelectual, limitación de responsabilidad e indemnización) continúan vigentes.',
      ],
    },
    {
      title: '11. Garantías y limitación de responsabilidad',
      body: [
        'El Servicio se provee "tal cual" y "según disponibilidad", sin garantías de ningún tipo, expresas o implícitas, incluyendo garantías de comerciabilidad, aptitud para un fin particular o no infracción. No garantizamos que el Servicio esté libre de errores o interrupciones.',
        'En la máxima medida permitida por la ley aplicable, R3SET no será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de datos, ingresos o ganancias derivados del uso o la imposibilidad de usar el Servicio. Nuestra responsabilidad total agregada frente a vos no superará el monto que hayas pagado por el Servicio en los últimos 12 meses.',
        'Nada en estos Términos limita responsabilidades que no puedan limitarse por ley (por ejemplo, en casos de dolo o negligencia grave, según la jurisdicción aplicable).',
      ],
    },
    {
      title: '12. Indemnización',
      body: [
        'Aceptás indemnizar y mantener indemne a R3SET, sus directores, empleados y afiliados frente a cualquier reclamo, daño, pérdida o gasto (incluyendo honorarios legales razonables) que surja de tu uso del Servicio, tu incumplimiento de estos Términos, o tu violación de derechos de terceros.',
      ],
    },
    {
      title: '13. Modificaciones a estos Términos',
      body: [
        'Podemos actualizar estos Términos periódicamente. Si hacemos cambios materiales, te vamos a notificar por email, dentro de la app, o mediante otro medio razonable, con anticipación a que entren en vigencia. El uso continuado del Servicio después de que los cambios entren en vigencia implica tu aceptación de los Términos actualizados.',
      ],
    },
    {
      title: '14. Ley aplicable',
      body: [
        'Estos Términos se rigen por las leyes de la República Argentina, sin perjuicio de las disposiciones de protección al consumidor que puedan aplicar en tu jurisdicción de residencia. Cualquier controversia se someterá a los tribunales competentes según la ley aplicable.',
      ],
    },
    {
      title: '15. Contacto',
      body: [
        'Si tenés preguntas sobre estos Términos, podés contactarnos a través de la sección de soporte dentro de la app o escribiendo a nuestro equipo a través de los canales oficiales de R3SET.',
      ],
    },
  ],
};

const en: LegalDocument = {
  documentTitle: 'Terms and Conditions',
  effectiveDate: 'Last updated: July 7, 2026',
  intro: [
    'These Terms and Conditions ("Terms") govern your use of R3SET (the "Service"), a platform that allows personal trainers and fitness coaches ("Trainers") to manage clients, training plans, nutrition tracking, messaging, and payments, and that allows their clients ("Clients" or "Users") to access those services through our web and mobile applications.',
    'By creating an account, accessing, or using the Service, you agree to be bound by these Terms and by our Privacy Policy. If you do not agree, you must not use the Service.',
    'Some Trainers offer the Service under their own brand ("white-label app"). Regardless of the name or logo you see, the Service is operated by R3SET, and these Terms apply the same way.',
  ],
  sections: [
    {
      title: '1. Eligibility and account registration',
      body: [
        'To use the Service you must be at least 18 years old, or the legal age of majority in your jurisdiction, and have the legal capacity to accept these Terms. If you are a minor, you need the consent of a parent or legal guardian, who agrees to these Terms on your behalf.',
        'You are responsible for the accuracy of the information you provide when registering (name, email, phone, health data you voluntarily share) and for keeping it up to date. You are responsible for all activity that occurs on your account and for keeping your login credentials confidential.',
        'We reserve the right to suspend or terminate accounts that contain false information, were created for fraudulent purposes, or that violate these Terms.',
      ],
    },
    {
      title: '2. Description of the Service',
      body: [
        'R3SET provides software tools for Trainers to design and assign training routines, track nutrition, communicate with their Clients, log measurements and progress, and manage payments and subscriptions.',
        'R3SET is not a Trainer or a healthcare professional. The coaching relationship, the design of the plans, and the recommendations are the sole responsibility of the Trainer you work with. R3SET only provides the technology infrastructure.',
        'We may modify, add, or discontinue features of the Service at any time, with or without prior notice, to improve the platform or for operational, legal, or security reasons.',
      ],
    },
    {
      title: '3. Subscriptions, pricing, and billing',
      body: [
        'Some plans offered by your Trainer require payment of a recurring subscription or a one-time payment, processed through Mercado Pago or other enabled payment processors. By subscribing, you authorize the periodic charge of the corresponding amount according to the frequency chosen (monthly, quarterly, semi-annual, or annual).',
        'Prices are set by each Trainer and may vary. If the price of your plan changes, you will be notified with reasonable advance notice before the new amount is applied to your next charge.',
        'Subscriptions renew automatically at the end of each billing period unless you cancel before the renewal date. You can cancel at any time from the app or by contacting your Trainer; cancellation takes effect at the end of the period already paid for, without prorated refunds unless applicable law provides otherwise.',
        'You are responsible for maintaining a valid payment method and for any charges resulting from outdated payment information.',
      ],
    },
    {
      title: '4. Health disclaimer and assumption of risk',
      body: [
        'The Service includes content related to physical training and nutrition. This content is general and informational in nature, and does not constitute medical advice, diagnosis, or treatment. Nothing on the Service replaces consultation with a physician or other qualified healthcare professional.',
        'Before starting any training program or dietary change, we recommend consulting a healthcare professional, especially if you have a pre-existing medical condition, are pregnant, or take medication.',
        'Physical exercise carries inherent risks, including injury. By using the Service, you knowingly and voluntarily accept those risks, and you use the routines, recommendations, and content at your own risk. If your Trainer asks you to sign a specific liability waiver, that document applies in addition to these Terms.',
        'R3SET, and to the extent permitted by law, your Trainer, will not be liable for injuries, damages, or losses arising from the use of the Service\'s training or nutritional content.',
      ],
    },
    {
      title: '5. User conduct',
      body: [
        'You agree to use the Service lawfully and respectfully. In particular, you agree not to: (a) harass, threaten, or discriminate against other users or trainers; (b) post defamatory, obscene content, or content that infringes third-party rights; (c) attempt to gain unauthorized access to other users\' accounts, systems, or data; (d) use the Service for purposes other than legitimate fitness/nutrition coaching; (e) reverse-engineer, copy, or distribute the Service\'s software without authorization.',
        'We reserve the right to suspend or terminate accounts that violate this section, without prior notice in serious cases.',
      ],
    },
    {
      title: '6. User content',
      body: [
        'The Service allows you to upload content such as progress photos, messages, measurements, and comments ("User Content"). You retain ownership of your User Content.',
        'By uploading User Content, you grant R3SET and your Trainer a non-exclusive, worldwide, royalty-free license to store, process, and display that content solely to provide you the Service (for example, so your Trainer can review your progress).',
        'You are responsible for having the necessary rights to the content you upload and for ensuring it does not infringe third-party rights.',
      ],
    },
    {
      title: '7. Intellectual property',
      body: [
        'The Service, its software, design, trademarks, and content developed by R3SET (excluding User Content and the specific content each Trainer creates for their Clients) are owned by R3SET or its licensors, and are protected by intellectual property laws.',
        'You are granted a limited, personal, non-exclusive, non-transferable license to use the Service in accordance with these Terms. No other rights are transferred to you.',
      ],
    },
    {
      title: '8. Third-party services',
      body: [
        'The Service integrates with external providers such as Mercado Pago (payment processing), Apple Health / Google Health Connect (health and activity data syncing, if you authorize it), and other calendar or communication services. Use of those third-party services is subject to their own terms and privacy policies, which we recommend reviewing.',
        'R3SET is not responsible for the operation, availability, or privacy practices of third-party services it does not directly control.',
      ],
    },
    {
      title: '9. Privacy',
      body: [
        'The processing of your personal data is governed by our Privacy Policy, which is an integral part of these Terms. There we detail what data we collect (including health data you voluntarily share, such as weight, measurements, or physical activity), what we use it for, and who we share it with (for example, with your Trainer, since that is essential to provide the Service).',
      ],
    },
    {
      title: '10. Termination',
      body: [
        'You can stop using the Service and request the deletion of your account at any time, by contacting your Trainer or through the app settings.',
        'We may suspend or terminate your access to the Service if you breach these Terms, if your Trainer deactivates your account, due to non-payment, or as required by law. Upon termination, certain provisions of these Terms (such as those on intellectual property, limitation of liability, and indemnification) remain in effect.',
      ],
    },
    {
      title: '11. Warranties and limitation of liability',
      body: [
        'The Service is provided "as is" and "as available," without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that the Service will be error-free or uninterrupted.',
        'To the maximum extent permitted by applicable law, R3SET will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, revenue, or profits arising from the use or inability to use the Service. Our total aggregate liability to you will not exceed the amount you paid for the Service in the last 12 months.',
        'Nothing in these Terms limits liabilities that cannot be limited by law (for example, in cases of willful misconduct or gross negligence, depending on the applicable jurisdiction).',
      ],
    },
    {
      title: '12. Indemnification',
      body: [
        'You agree to indemnify and hold harmless R3SET, its directors, employees, and affiliates from any claim, damage, loss, or expense (including reasonable legal fees) arising from your use of the Service, your breach of these Terms, or your violation of third-party rights.',
      ],
    },
    {
      title: '13. Changes to these Terms',
      body: [
        'We may update these Terms periodically. If we make material changes, we will notify you by email, within the app, or through another reasonable means, before they take effect. Continued use of the Service after changes take effect constitutes your acceptance of the updated Terms.',
      ],
    },
    {
      title: '14. Governing law',
      body: [
        'These Terms are governed by the laws of the Argentine Republic, without prejudice to consumer protection provisions that may apply in your jurisdiction of residence. Any dispute will be submitted to the competent courts under applicable law.',
      ],
    },
    {
      title: '15. Contact',
      body: [
        'If you have questions about these Terms, you can contact us through the support section within the app or by writing to our team through R3SET\'s official channels.',
      ],
    },
  ],
};

export const termsAndConditions: { es: LegalDocument; en: LegalDocument } = { es, en };
