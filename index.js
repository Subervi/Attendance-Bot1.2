const { Client, GatewayIntentBits } = require('discord.js');
const moment = require('moment');
const fs = require('fs'); 
const path = require('path'); 

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let checkInData = {}; 

const loadData = () => {
    const filePath = path.join(__dirname, 'registros.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        checkInData = JSON.parse(data);
    }
};

const saveData = () => {
    const filePath = path.join(__dirname, 'registros.json');
    fs.writeFileSync(filePath, JSON.stringify(checkInData, null, 2));
};

client.once('ready', () => {
    console.log('El bot está listo!');
    loadData(); 
});

client.on('messageCreate', message => {
    if (message.author.bot) return; // Ignorar mensajes de bots

    // Verificar si el mensaje fue enviado en el canal específico
    if (message.channel.id !== '1288943044954951824') {
        return message.reply('Los comandos solo se pueden usar en el canal ✅┃check-in-out.');
    }
    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (['checkin', 'checkout', 'registro'].includes(command) && !hasRole(message.member, '966695959235006465')) {
        return message.reply('No tienes permiso para usar este comando.'); 
    }

    if (command === 'checkin') {
        const employee = message.author.displayName;
        const time = moment().format('HH:mm, DD-MM');
    
        if (checkInData[employee] && checkInData[employee].checkInTime) {
            return message.reply(`${employee}, ya estás registrado en OnDuty.`);
        } else {
            checkInData[employee] = { checkInTime: time, checkOutTimes: [] };
            saveData();
    
            // Remover el rol de OffDuty antes de agregar el rol de OnDuty
            const roleOffDuty = message.guild.roles.cache.get('1289556342809296940');
            if (roleOffDuty) {
                message.member.roles.remove(roleOffDuty).catch(console.error);
            }
    
            // Asignar el rol de OnDuty
            const roleOnDuty = message.guild.roles.cache.get('1289376647094730853');
            if (roleOnDuty) {
                message.member.roles.add(roleOnDuty).catch(console.error);
            }
    
            return message.reply(`${employee}, hiciste check-in a las ${time}. Estás OnDuty.`);
        }
    }
    
    if (command === 'checkout') {
        const employee = message.author.displayName;
        const time = moment().format('HH:mm, DD-MM');
    
        if (!checkInData[employee] || !checkInData[employee].checkInTime) {
            return message.reply(`${employee}, no has hecho check-in aún.`);
        } else {
            const checkInTime = moment(checkInData[employee].checkInTime, 'HH:mm, DD-MM');
            const checkOutTime = moment(time, 'HH:mm, DD-MM');
            const duration = moment.duration(checkOutTime.diff(checkInTime));
            const hours = duration.hours();
            const minutes = duration.minutes();
    
            checkInData[employee].checkOutTimes.push({ checkOutTime: time, duration: { hours, minutes } });
    
            // Remover el rol de OnDuty
            const roleOnDuty = message.guild.roles.cache.get('1289376647094730853');
            if (roleOnDuty) {
                message.member.roles.remove(roleOnDuty).catch(console.error);
            }
    
            // Asignar el rol de OffDuty
            const roleOffDuty = message.guild.roles.cache.get('1289556342809296940');
            if (roleOffDuty) {
                message.member.roles.add(roleOffDuty).catch(console.error);
            }
    
            message.reply(`${employee}, hiciste check-out a las ${time}. Estuviste OnDuty durante ${hours} horas y ${minutes} minutos.`);
            checkInData[employee].checkInTime = null; 
            saveData(); 
        }
    }
    
    

    if (command === 'registro') {
        const employee = message.author.displayName;

        if (!checkInData[employee]) {
            return message.reply(`${employee}, no tienes historial de check-in.`);
        } else {
            const checkInTime = checkInData[employee].checkInTime || "No registrado";
            const checkOutTimes = checkInData[employee].checkOutTimes;

            // Calcular horas totales hoy
            let totalTodayHours = 0;
            let totalTodayMinutes = 0;

            checkOutTimes.forEach(checkOut => {
                const checkOutMoment = moment(checkOut.checkOutTime, 'HH:mm, DD-MM');
                if (checkOutMoment.isSame(moment(), 'day')) {
                    totalTodayHours += checkOut.duration.hours; 
                    totalTodayMinutes += checkOut.duration.minutes; 
                }
            });

            // Ajustar minutos a horas
            totalTodayHours += Math.floor(totalTodayMinutes / 60);
            totalTodayMinutes = totalTodayMinutes % 60;

            // Calcular horas totales de la semana
            let totalWeekHours = 0;
            let totalWeekMinutes = 0;

            checkOutTimes.forEach(checkOut => {
                const checkOutMoment = moment(checkOut.checkOutTime, 'HH:mm, DD-MM');
                if (checkOutMoment.isSame(moment(), 'week')) {
                    totalWeekHours += checkOut.duration.hours; 
                    totalWeekMinutes += checkOut.duration.minutes; 
                }
            });

            // Ajustar minutos a horas
            totalWeekHours += Math.floor(totalWeekMinutes / 60);
            totalWeekMinutes = totalWeekMinutes % 60;

            return message.reply(`Historial de ${employee}:\nCheck-in a las ${checkInTime}\nTotal de horas hoy: ${totalTodayHours} horas y ${totalTodayMinutes} minutos\nTotal de horas esta semana: ${totalWeekHours} horas y ${totalWeekMinutes} minutos`);
        }
    }

    if (command === 'historial') {
        if (!hasRole(message.member, '969409866596778034') && 
            !hasRole(message.member, '1288917994243883029') && 
            !hasRole(message.member, '1289011464773959778')) {
            return message.reply('No tienes permiso para usar este comando.');
        }

        let historial = 'Historial de horas trabajadas por todos los empleados:\n';
        for (const [employee, data] of Object.entries(checkInData)) {
            if (data.checkOutTimes.length > 0) {
                const totalHours = calculateTotalHours(employee);
                historial += `${employee}: ${totalHours}\n`;
            }
        }
        message.reply(historial || 'No hay registros disponibles.');
    }
});

const calculateTotalHours = (employee) => {
    let totalHours = 0;
    let totalMinutes = 0;
    if (checkInData[employee]) {
        checkInData[employee].checkOutTimes.forEach(checkOut => {
            totalHours += checkOut.duration.hours; 
            totalMinutes += checkOut.duration.minutes; 
        });
    }
    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    return `${totalHours} horas y ${totalMinutes} minutos`;
};

const hasRole = (member, roleId) => {
    return member.roles.cache.has(roleId);
};

process.on('SIGINT', () => {
    saveData();
    console.log('Datos guardados. Cerrando el bot...');
    process.exit();
});

client.login('MTI4OTUyNzc1ODI3MTI4MzI3MA.GG3c9R.LY-PSvKJ1nQdaUrifLl2hvS4ZOJNwk9JAP7C4M');
