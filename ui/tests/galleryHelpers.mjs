export async function holdGame(card){
 const page=card.page();await card.scrollIntoViewIfNeeded();await card.hover();await page.mouse.down();
 try{await page.locator('.game-detail').waitFor({state:'visible',timeout:3000});}finally{await page.mouse.up();}
}
