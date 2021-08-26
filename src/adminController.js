const sequelize = require('sequelize')

Date.prototype.isValid = function () {
    // An invalid date object returns NaN for getTime() and NaN is the only
    // object not strictly equal to itself.
    return this.getTime() === this.getTime();
};

const bestProfession = async (req, res, next) => {
    const startDate = new Date(req.query.start)
    const endDate = new Date(req.query.end)

    if (!startDate.isValid() || !endDate.isValid()) {
        res.status(500).send('Invalid dates')
        return
    }

    const { Job, Contract, Profile } = req.app.get('models')

    const jobs = await Job.findAll({
        include: {
            model: Contract,
            as: 'Contract',
            include: {
                model: Profile,
                as: 'Contractor',
            },
        },
        where: {
            paid: true,
            paymentDate: {
                [sequelize.Op.gte]: startDate,
                [sequelize.Op.lte]: endDate,
            }
        },
        group: 'Contract.Contractor.profession',
        attributes: [
            [sequelize.fn('sum', sequelize.col('price')), 'sum_prices']
        ],
        order: [
            [sequelize.col('sum_prices'), 'DESC']
        ],
    })

    const bestJob = jobs[0]

    if (bestJob) {
        req.message = jobs[0]?.Contract.Contractor.profession
    } else {
        res.status(404).end("No jobs found for those dates")
        return
    }

    next()
}

const bestClients = async (req, res, next) => {
    const startDate = new Date(req.query.start)
    const endDate = new Date(req.query.end)

    if (!startDate.isValid() || !endDate.isValid()) {
        res.status(500).send('Invalid dates')
        return
    }

    const { Job, Contract, Profile } = req.app.get('models')

    // We can do everything in a not-so-simple query
    const jobs = await Job.findAll({
        include: {
            model: Contract,
            as: 'Contract',
            include: {
                model: Profile,
                as: 'Client',
                attributes: [
                    [sequelize.literal(`firstName || ' ' || lastName`), 'fullName'],
                    'id'
                ]
            },
        },
        where: {
            paid: true,
            paymentDate: {
                [sequelize.Op.gte]: startDate,
                [sequelize.Op.lte]: endDate,
            }
        },
        group: 'Contract.Client.id',
        attributes: [
            [sequelize.fn('sum', sequelize.col('price')), 'paid']
        ],
        order: [
            [sequelize.col('paid'), 'DESC']
        ],
        limit: req.query.limit || 2
    })

    // Let's format the output
    const formattedJobs = []
    for (const job of jobs) {
        formattedJobs.push({
            ...job.Contract.Client.dataValues,
            paid: job.paid,
        })
    }

    req.message = formattedJobs
    next()
}
module.exports = { bestProfession, bestClients }
