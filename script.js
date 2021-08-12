document.open()
document.write(`<script>
window.onload = function() {
document.body.textContent = "page: "+location.pathname
}
</script>`)
document.close()
