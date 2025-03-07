 // #!/usr/bin/env node

 const inquirer = require('inquirer');
 const axios = require('axios');
 const chalk = import('chalk');

 const API_BASE = 'http://localhost:3000/api';

 const mainMenu = () => {
   return inquirer.prompt([
     {
       type: 'list',
       name: 'action',
       message: 'What would you like to do?',
       choices: [
         'List tournaments',
         'Create tournament',
         'Delete tournament',
         'Reset tournament',
         'Add fixtures',
         'Update score',
         'Exit'
       ]
     }
   ]);
 };

 const listTournaments = async () => {
   try {
     const { data } = await axios.get(`${API_BASE}/tournaments`);
     return data.data;
   } catch (error) {
     console.error(chalk.red('Error fetching tournaments:', error.message));
     return [];
   }
 };

 const run = async () => {
   const { default: chalk } = await import('chalk');
   console.log(chalk.blue('\n🏆 Tournament Manager CLI 🏆\n'));

   while (true) {
     const { action } = await mainMenu();

     switch (action) {
       case 'List tournaments':
         const tournaments = await listTournaments();
         if (tournaments.length === 0) {
           console.log((await chalk).default.yellow('No tournaments found'));
         } else {
           console.log((await chalk).default.green('\nAvailable tournaments:'));
           tournaments.forEach((t, i) => {
             console.log(`${i + 1}. ${t.Title} (ID: ${t.id})`);
           });
         }
         break;

       case 'Create tournament':
         const newTournament = await inquirer.prompt([
           {
             name: 'title',
             message: 'Tournament title:'
           },
           {
             name: 'date',
             message: 'Date (YYYY-MM-DD):'
           },
           {
             name: 'location',
             message: 'Location:'
           }
         ]);

         try {
           const { data } = await axios.post(`${API_BASE}/tournaments`, newTournament);
           console.log((await chalk).default.green(`\nCreated tournament with ID: ${data.data.id}`));
         } catch (error) {
           console.error((await chalk).default.red('Error creating tournament:', error.message));
         }
         break;

       case 'Delete tournament':
         const tournamentsToDelete = await listTournaments();
         if (tournamentsToDelete.length === 0) break;

         const { tournamentId } = await inquirer.prompt([
           {
             type: 'list',
             name: 'tournamentId',
             message: 'Select tournament to delete:',
             choices: tournamentsToDelete.map(t => ({
               name: `${t.Title} (ID: ${t.id})`,
               value: t.id
             }))
           }
         ]);

         try {
           await axios.delete(`${API_BASE}/tournaments/${tournamentId}`);
           console.log((await chalk).default.green('\nTournament deleted successfully'));
         } catch (error) {
           console.error((await chalk).default.red('Error deleting tournament:', error.message));
         }
         break;

       case 'Reset tournament':
         const tournamentsToReset = await listTournaments();
         if (tournamentsToReset.length === 0) break;

         const { resetId } = await inquirer.prompt([
           {
             type: 'list',
             name: 'resetId',
             message: 'Select tournament to reset:',
             choices: tournamentsToReset.map(t => ({
               name: `${t.Title} (ID: ${t.id})`,
               value: t.id
             }))
           }
         ]);

         try {
           await axios.post(`${API_BASE}/tournaments/${resetId}/reset`);
           console.log((await chalk).default.green('\nTournament reset successfully'));
         } catch (error) {
           console.error((await chalk).default.red('Error resetting tournament:', error.message));
         }
         break;

       case 'Exit':
         console.log((await chalk).default.blue('\nGoodbye! 👋\n'));
         process.exit(0);

       default:
         console.log((await chalk).default.yellow('\nFeature coming soon!'));
     }

     console.log('\n');
   }
 };

 run().catch(err => {
   console.error((await chalk).default.red('Fatal error:', err));
   process.exit(1);
 });

