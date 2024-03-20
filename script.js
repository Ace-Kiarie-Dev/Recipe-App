fetch(url + "pizza").then((response) => response.json().then((data) => {
   
    
     for(let i in myMeal){
        let ingredient = "";
        let measure = "";

        if(i.startsWith("strIngredient") && myMeal[i]){
            ingredient = myMeal[i];
            measure = myMeal[`strMeasure`+ count];
            count += 1;
           ingredients.push(`${measure} ${ingredient}`);
        }
     }

     console.log(myMeal);

     result.innerHTML = `
        <img src=${mealImg} />
     `
})
)