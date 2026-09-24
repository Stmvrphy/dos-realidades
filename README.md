# Dos realidades

Ejercicio 02 del curso (DPPI 2026), sobre visión artificial y representación. La idea era tomar una sola cámara y usarla para armar dos maneras completamente distintas de "ver" lo mismo.

**Demo:** https://fefeliperoar.github.io/dos-realidades/
**Repo:** https://github.com/fefeliperoar/dos-realidades

## De qué se trata

Hay dos sistemas corriendo al mismo tiempo, con la misma cámara. Ninguno de los dos muestra la imagen de la cámara tal cual — cada uno se queda solo con el dato que le importa y lo dibuja a su manera. Por eso terminan pareciendo dos cosas distintas aunque estén mirando lo mismo.

**Sistema A — Visión Corporal.** Usa MediaPipe para encontrar los puntos del cuerpo de la persona (hombros, codos, caderas, rodillas, etc.) en cada frame. En vez de mostrar esos puntos tal cual, se dibujan conectados por líneas curvas que se mueven levemente solas, como si fueran un tejido vivo en lugar de un esqueleto rígido. Cada zona del cuerpo (cabeza, torso, brazos, piernas) tiene su propio color, y los puntos se ven más grandes o más chicos según qué tan segura está la detección y qué tan cerca está esa parte del cuerpo de la cámara. Si no hay nadie en cuadro, en el centro aparecen unos anillos suaves pulsando, como si el sistema estuviera "buscando" un cuerpo.

**Sistema B — Movimiento.** Este no reconoce cuerpos ni nada en particular: solo compara cada frame con el anterior y se fija dónde cambió el brillo de la imagen. Donde detecta un cambio, nacen partículas — mientras más brusco fue el cambio, más partículas aparecen, más rápido se mueven y más grandes son. El color también cuenta algo: los cambios suaves se ven en tonos azules/violetas y los cambios bruscos en tonos naranjos. Las partículas se van apagando solas con el tiempo y dejan una especie de estela, en vez de desaparecer de golpe.

## Cómo probarlo

El `index.html` no se puede abrir directo con doble clic porque el script usa módulos de JS. Hay que levantar un servidor local desde la carpeta, por ejemplo:

```
python3 -m http.server 8000
```

y entrar a `http://localhost:8000`. Va a pedir permiso de cámara — hay que aceptarlo y apretar el botón "Cámara".

## Reflexión

Frente a la cámara ocurre una sola escena, pero cada sistema encuentra algo distinto en ella. Uno mapea la geometría de las manos y las transforma en nodos y vectores; el otro detecta las variaciones de movimiento y contraste en el espacio. Ninguno está equivocado, pero ninguno puede abarcar la totalidad del gesto.

Langdon Winner explicaba que los artefactos técnicos encarnan formas de ver y ordenar el mundo. Con las computadoras ocurre algo similar: aquello que pueden interpretar de nuestra comunicación depende de la estructura técnica que les hemos dado y de los datos que hemos decidido enseñarles a priorizar.

Merleau-Ponty nos recuerda que el lenguaje no vive solo en la abstracción de las palabras, sino en la encarnación de nuestro cuerpo en el mundo. Extendemos el sentido de lo que decimos a través del movimiento de las manos, proyectando intenciones que trascienden el texto. Los puntos y los flujos ópticos de un algoritmo intentan atrapar esa gesticulación, pero jamás podrán capturar la vivencia del gesto que acompaña a la voz.

Tal vez lo fascinante de construir una tecnología que observa nuestros gestos no sea preguntarnos cuánto logra codificar, sino comenzar a reconocer toda esa dimensión expresiva y humana que, inevitablemente, se le escapa.

## Tecnologías

MediaPipe Pose Landmarker (cargado desde CDN) y Canvas 2D con JavaScript puro, sin frameworks ni build.

---
Noelia Landaburu, Sebastian Urquiza · Ejercicio 02 — Dos realidades · DPPI 2026
