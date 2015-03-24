# lite - Live Templates


## Quick start:

```bash
# Install via Bower
bower install lite
```

or

```bash
# Install via NPM
npm install lite
```

or

```html
<!-- Use it via unofficial CDN -->
<script src="https://cdn.rawgit.com/atmin/lite/v0.0.1/lite.js"></script>
```

## Hello, lite

```html
<!DOCTYPE html>

<!-- (1) Target, references template -->
<div id="target"></div>

<!-- (2) Template, references model -->
<script id="template" type="text/template">
  <label>
    Greet goes to
    <input value="{{who}}">
  </label>
  <h3>Hello, {{who}}</h3>
</script>

<!-- (3) Data model -->
<script id="model" type="text/model">
  {
    who: 'world'
  }
</script>

<!--(4) Setup lite -->
<script src="https://cdn.rawgit.com/atmin/lite/v0.0.1/lite.js"></script>
```
