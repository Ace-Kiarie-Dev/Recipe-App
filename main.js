//initializing the variables.

let result = document.getElementById("results");
let searchBtn = document.getElementById("search-btn");
let url = "https://www.themealdb.com/api/json/v1/1/search.php?s=";

//Tracking user search input

searchBtn.addEventListener("click", () => {

    //User Input value

    let userInp = document.getElementById("user-inp").value;

    if(userInp.length == 0){
        results.innerHTML = `<h3>🤨 Input Field Cannot Be Empty 🤨</h3>`;
    } else {

        //Getting the data from the FREE MEAL API

fetch(url + userInp).then(response => response.json()).then(data => {
    console.log(data);

    //variables we need for the app's result

    let myMeal = data.meals[0];
    let mealImg = myMeal.strMealThumb;
    let mealTitle = myMeal.strMeal;
    let mealArea = myMeal.strArea;
    let mealCategory = myMeal.strCategory;
    let mealInst = myMeal.strInstructions

     //logging the meal data for reference while fetching.

     console.log(myMeal);
     console.log(mealImg);
     console.log(mealTitle);
     console.log(mealArea);
     console.log(mealCategory);
     console.log(mealInst);

     //Looping out the instructions 

     let count = 1;
     let ingredients = [];

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

     console.log(ingredients);

     //Filling the result section

     result.innerHTML = `
        <img src= ${mealImg} />
        <div class="details">
            <h2> ${mealTitle} </h2>
            <h4> ${mealArea} </h4>
        </div>

        <div id = "ingredient-con"></div>
        <div id = "recipe">
            <button id= "hide-recipe" >X</button>
            <pre id = "instructions">${mealInst}</pre>
        </div>
        <button id="show-recipe">View Recipe</button>
     `;

//initializing ingredient variables

     let ingredientCon = document.getElementById('ingredient-con');
     let parent = document.createElement('ul');
     let recipe = document.getElementById('recipe');
     let hideRecipe = document.getElementById('hide-recipe');
     let showRecipe = document.getElementById('show-recipe');

 //looping out the ingredients within their container.

     ingredients.forEach((i) => {
         let child = document.createElement('li');
         child.innerText = i;
         parent.appendChild(child);
         ingredientCon.appendChild(parent);
     });
//Hide The Recipe

     hideRecipe.addEventListener('click', () => {
        recipe.style.display = 'none';
     });
//Show The Recipe

     showRecipe.addEventListener('click', () => {
        recipe.style.display = 'block';
     });
//Catch any events.

}).catch(() =>{result.innerHTML = 
    `
        <h3>Im sorry 😥 , But we could not find this meal.</h3>
        <h5>Try checking the spelling, or try a different dish. 🙂</h5>
    `})
    };
})

