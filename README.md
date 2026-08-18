# L'ARTE — Menu board das TVs

Site do carrossel que roda nas TVs da loja (Fire TV Stick apontando para a
pagina publicada). **Publicar = push**: qualquer mudanca em `slides.json` ou
nas imagens chega nas TVs em ate 10 minutos, sem tocar em TV nenhuma.

- `index.html` — o player (crossfade, atualizacao sozinha a cada 10 min)
- `slides.json` — ordem e tempo de cada slide
- `*.jpg` — os slides em 1920x1080

Os slides nascem no repositorio principal (gastroos), em `apps/signage`:
o gerador confere cada preco contra o cardapio do sistema antes de compor.
Este repositorio e so a vitrine publicada.
